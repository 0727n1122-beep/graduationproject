from fastapi import FastAPI, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from typing import Optional
import anthropic
import tiktoken
import os
import json
import re

# ── 환경변수 로드 ──────────────────────────────────────────
load_dotenv()

# ── DB 초기화 ──────────────────────────────────────────────
from sqlalchemy import inspect, text
from database import engine, Base, SessionLocal
from models import PromptHistory
import models  # Base에 테이블 등록용

Base.metadata.create_all(bind=engine)  # 서버 시작 시 테이블 자동 생성

# create_all은 이미 있는 테이블은 건드리지 않으므로, 나중에 모델에 추가된 컬럼이
# 기존에 배포된 DB의 prompt_histories 테이블엔 없을 수 있음 — 없을 때만 안전하게 추가.
_inspector = inspect(engine)
if "prompt_histories" in _inspector.get_table_names():
    _existing_cols = {c["name"] for c in _inspector.get_columns("prompt_histories")}
    _json_col_type = "JSON" if engine.dialect.name == "postgresql" else "TEXT"
    for _new_col in ("categories", "diagnosis_detail"):
        if _new_col not in _existing_cols:
            with engine.begin() as conn:
                conn.execute(text(f"ALTER TABLE prompt_histories ADD COLUMN {_new_col} {_json_col_type}"))

# ── 라우터 import ──────────────────────────────────────────
from auth import router as auth_router, decode_token
from history import router as history_router
from error_coach import router as error_coach_router
from rag.retrieve import retrieve_for_issue

# ── FastAPI 앱 초기화 ──────────────────────────────────────
app = FastAPI()

# ── CORS 설정 ──────────────────────────────────────────────
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── 라우터 등록 ────────────────────────────────────────────
app.include_router(auth_router)       # /auth/register, /auth/login 등
app.include_router(history_router)    # /history
app.include_router(error_coach_router)  # /error-coach
from simulate import router as simulate_router
app.include_router(simulate_router)

# ── Anthropic 클라이언트 ───────────────────────────────────
client = anthropic.Anthropic(
    api_key=os.getenv("ANTHROPIC_API_KEY"),
    base_url=os.getenv("ANTHROPIC_BASE_URL"),
)

# ── 요청 모델 ──────────────────────────────────────────────
class PromptRequest(BaseModel):
    prompt: str

# ── 토큰 계산 함수 ─────────────────────────────────────────
def count_tokens(text: str) -> int:
    enc = tiktoken.get_encoding("cl100k_base")
    return len(enc.encode(text))

# ── 모델별 비용 계산 (1M 토큰당 USD) ──────────────────────
MODELS = {
    "claude-opus-4":    {"input": 15,   "output": 75},
    "claude-sonnet-4":  {"input": 3,    "output": 15},
    "claude-haiku-3-5": {"input": 0.8,  "output": 4},
    "gpt-4o":           {"input": 2.5,  "output": 10},
    "gpt-4o-mini":      {"input": 0.15, "output": 0.6},
    "gemini-2-5-pro":   {"input": 1.25, "output": 10},
    "gemini-2-5-flash": {"input": 0.15, "output": 0.6},
}

# ── 카테고리별 가이드 사전 ─────────────────────────────────
GUIDES = {
    "AMBIGUOUS": {
        "title": "모호한 표현",
        "tip": "'이거', '그거' 대신 구체적인 대상을 명시하세요",
        "example_bad": "이거 좀 고쳐줘",
        "example_good": "위 코드의 23번째 줄 IndexError를 수정해줘"
    },
    "FILLER": {
        "title": "불필요한 군더더기",
        "tip": "감탄사와 우회 표현은 토큰을 낭비합니다",
        "example_bad": "아 그리고 혹시 가능하시다면 해줘",
        "example_good": "추가로 X 기능을 포함해줘"
    },
    "REDUNDANT": {
        "title": "중복 표현",
        "tip": "같은 요구는 한 번만 명시하세요",
        "example_bad": "에러 처리도 하고 예외 처리도 꼭 해줘",
        "example_good": "try-except로 예외 처리 포함"
    },
    "UNSTRUCTURED": {
        "title": "흩어진 요구사항",
        "tip": "여러 요구는 번호 리스트로 정리하세요",
        "example_bad": "A도 하고 B도 하고 그리고 C도",
        "example_good": "요구사항: 1) A 2) B 3) C"
    },
    "CODE_DUMP": {
        "title": "코드 전체 전송",
        "tip": "에러가 난 부분만 잘라서 보내세요",
        "example_bad": "200줄 코드 전체 + 고쳐줘",
        "example_good": "에러 발생 함수 10줄 + 에러 메시지"
    },
    "MISSING_CONSTRAINT": {
        "title": "출력 조건 누락",
        "tip": "언어, 형식, 길이 등 조건을 명시하세요",
        "example_bad": "코드 짜줘",
        "example_good": "Python 3.12, 함수형, 한국어 주석 포함"
    },
    "MONOLITHIC_REQUEST": {
        "title": "분할 없는 통합 요청",
        "tip": "여러 기능을 한 번에 요청하면 연쇄 버그가 발생해요. 단계별로 나눠서 요청하세요",
        "example_bad": "로그인·게시판·결제 다 되는 사이트 만들어줘",
        "example_good": "1단계: 로그인 기능만 먼저 만들어줘. 동작하면 다음 단계로"
    },
}

# ── 카테고리 → scope 매핑 ──────────────────────────────────
# UNSTRUCTURED는 사용자 상호작용(토글 선택) 없이 텍스트가 그대로 바뀌는 경우라 inline.
# MONOLITHIC_REQUEST만 "계획 확인 → 단계 토글"이라는 상호작용이 있어 structural.
STRUCTURAL_CATEGORIES = {"MONOLITHIC_REQUEST"}

def infer_scope(category: str) -> str:
    """카테고리로 scope 자동 추론 (inline vs structural)"""
    return "structural" if category in STRUCTURAL_CATEGORIES else "inline"

def find_verbatim(snippet: str, prompt: str):
    """모델이 만든 snippet이 원본에 정확히 없어도, 공백류(개행·탭·연속 스페이스)
    차이만 있으면 원본에서 실제 매칭되는 부분(개행 포함, 완전한 verbatim)을 찾아 반환한다.
    (MONOLITHIC_REQUEST/UNSTRUCTURED처럼 snippet이 여러 줄에 걸치는 카테고리에서, 모델이
    원본의 줄바꿈을 공백으로 재현하는 바람에 verbatim 검증에 걸려 이슈 전체가 드롭되던
    문제 — 실측 재현됨). 못 찾으면 None."""
    words = [w for w in re.split(r"\s+", snippet.strip()) if w]
    if not words:
        return None
    if snippet in prompt:
        return snippet
    pattern = r"\s+".join(re.escape(w) for w in words)
    m = re.search(pattern, prompt)
    return m.group(0) if m else None


def attach_source(category: str, query_text: str):
    """카테고리에 맞는 근거 청크(rag/chunks.json)를 찾아 issues[]/missing_constraints[]에
    붙일 수 있는 형태로 변환. 근거가 없거나 검색 실패 시 None(정직하게 인용 생략)."""
    chunks = retrieve_for_issue(category, query_text)
    if not chunks:
        return None
    return [
        {"doc": c["doc"], "section": c["section"], "url": c["url"], "quote": c["text"]}
        for c in chunks
    ]

# ── 비용 계산 함수 ─────────────────────────────────────────
def calculate_costs(input_tokens: int, output_tokens: int) -> dict:
    costs = {}
    for model, price in MODELS.items():
        before = (input_tokens / 1_000_000) * price["input"] + \
                 (input_tokens * 2 / 1_000_000) * price["output"]
        after = (output_tokens / 1_000_000) * price["input"] + \
                (output_tokens * 2 / 1_000_000) * price["output"]
        costs[model] = {"before": round(before, 6), "after": round(after, 6)}
    return costs

# ── 헬스체크 ───────────────────────────────────────────────
@app.get("/")
def root():
    return {"status": "ok", "message": "Minifi API"}

# ── 프롬프트 최적화 ────────────────────────────────────────
@app.post("/optimize")
async def optimize(
    request: PromptRequest,
    authorization: Optional[str] = Header(None)  # 로그인 유저 히스토리 자동 저장용
):
    prompt = request.prompt

    # Step 1: 룰 기반 사전 차단
    if not prompt or not prompt.strip():
        return {"error": "프롬프트를 입력해주세요.", "code": "EMPTY_INPUT"}
    if len(prompt) > 5000:
        return {"error": "프롬프트가 너무 깁니다. 5000자 이하로 입력해주세요.", "code": "TOO_LONG"}
    if len(prompt.strip()) < 5:
        return {"error": "프롬프트가 너무 짧습니다.", "code": "TOO_SHORT"}

    # Step 2: 원본 토큰 수 계산
    original_tokens = count_tokens(prompt)

    # Step 3: Claude API 호출
    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=4096,
        messages=[
            {
                "role": "user",
                "content": f"""당신은 LLM 프롬프트 최적화 전문가입니다. 비개발자가 작성한 복잡한 코딩·과제 프롬프트의 토큰 낭비를 줄이는 데 특화되어 있습니다.

[원본 프롬프트]
\"\"\"
{prompt}
\"\"\"

[0단계: 이미 최적화됨 판정 (L0)]
아래를 모두 만족하면 "이미 최적화됨"으로 즉시 판정하고 종료:
- 요구사항이 번호나 구조로 이미 정리되어 있음
- 모호한 지시어·군더더기 없음
- 필수 조건이 명시되어 있거나 "[입력 필요]"/"(예: ...)" 같은 의도된 placeholder로 표시됨
이 경우: optimized = 원본 그대로. issues = []. missing_constraints = []. 아래 1~2단계는 건너뛴다.
"더 나아질 수 있다"는 이유로 이미 좋은 프롬프트를 재작성하지 말 것 — 그 자체가 오류다.

[1단계: 입력 복잡도 판정]
다음 신호 중 하나라도 있으면 "복잡 입력":
- 코드 블록 또는 5줄 이상의 코드
- 3개 이상의 요구사항/기능이 줄글로 흩어져 있음
- 200자 이상이며 코딩/디버깅/과제/리서치 맥락
- 다중 컨텍스트 (긴 배경 설명 + 본 요청)
그 외는 "단순 입력".

[2단계: 복잡도별 처리 방식]

📍 단순 입력 처리 (가장 중요)
- optimized는 원본을 최대한 보존. 손대지 않는 것이 기본값.
- 출력 조건·형식 제약·도구·수치를 절대 임의 추가 금지.
- 명백한 모호함이 있어도 issues에만 기록하고 optimized는 거의 그대로.
- optimized의 토큰 수가 원본보다 늘어나지 않도록 할 것.

📍 복잡 입력 처리
- CODE_DUMP, MONOLITHIC_REQUEST, UNSTRUCTURED, MISSING_CONSTRAINT를 우선 탐지.
- 적극적 재구조화 허용:
  · 코드 덤프 → 에러 발생 위치 + 에러 메시지만 분리 제안
  · 여러 기능 통합 요청 → 논리적 개발 순서로 단계 분할 + "첫 단계부터 진행" 지시
  · 흩어진 요구 → 번호 리스트로 구조화
  · 장황한 배경 → 핵심 요청만 남기고 압축
- 미지정 사양은 "(예: ...)" 또는 "[입력 필요]" 플레이스홀더 사용.

[JSON 스키마]
{{
  "optimized": "최적화된 프롬프트 전문 (한국어)",
  "issues": [
    {{
      "id": "이슈 고유 id. i1부터 순번 (i1, i2, i3...)",
      "category": "AMBIGUOUS | FILLER | REDUNDANT | UNSTRUCTURED | CODE_DUMP | MONOLITHIC_REQUEST",
      "snippet": "문제가 된 부분의 원문 그대로. CODE_DUMP는 코드 전체, UNSTRUCTURED는 흩어진 요구사항 전체를 그대로(둘 다 길이 제한 없음). 그 외 카테고리는 핵심 표현만 30자 미만 엄수(초과 시 앞부분만 쓰고 '…' 처리)",
      "explanation": "왜 토큰, 비용 낭비로 이어지는지 간결하게(1-2문장)",
      "replacement": "적용 시 그 자리에 들어갈 텍스트. 삭제면 빈 문자열 \"\". CODE_DUMP는 진단 문구 뒤에 원본 코드를 verbatim으로 이어붙인 것(코드 삭제·요약 금지, 아래 카테고리 정의 참고), UNSTRUCTURED는 번호 리스트로 재구성한 문장. scope가 structural(MONOLITHIC_REQUEST)이면 null",
      "occurrence": "원본 프롬프트 내에서 이 snippet이 몇 번째로 등장하는지 (0부터 시작). 같은 snippet이 여러 번 나오면 등장 순서대로 0, 1, 2...를 각각 부여",
      "steps": "MONOLITHIC_REQUEST일 때만: [{{\"title\": \"단계명(짧게)\", \"desc\": \"1문장 설명\", \"verify\": \"이 단계가 끝났다는 걸 확인하는 구체적 방법 1문장\"}}, ...] 3~6개. 다른 카테고리는 null"
    }}
  ],
  "missing_constraints": [
    {{
      "id": "누락 조건 고유 id. mc1부터 순번 (mc1, mc2, mc3...). issues의 id(i1, i2...)와 접두사가 다르니 섞어 쓰지 말 것",
      "field": "빠진 조건 이름 (예: '출력 언어', '코드 형식')",
      "confidence": "high | rec | low — 4장 기준 준수",
      "suggested_value": "짧은 값 (예: 'Python 3.12'). confidence가 low면 반드시 null",
      "suggested_phrase": "프롬프트에 그대로 삽입될 완성 문장 (예: 'Python 3.12로 작성해주세요.'). confidence가 low면 반드시 null",
      "options": "confidence가 low일 때만: [{{\"label\": \"선택지 이름\", \"phrase\": \"프롬프트에 삽입될 문장 또는 null\"}}, ...] 2~4개. high/rec는 null"
    }}
  ]
}}

MISSING_CONSTRAINT는 issues 배열에 넣지 않는다. missing_constraints 배열에만 기록한다.

[출력 규칙 — 절대 준수]
- 순수 JSON 객체만 출력. 백틱(```), "json" 표시, 설명 문장, 인사말 일절 금지.
- 응답의 첫 글자는 {{, 마지막 글자는 }}.
- issues 배열은 최소 0개, 최대 5개. 가장 중요한 문제부터.
- issues=[]는 "분석 결과 개선할 점이 없음"을 의미한다. 칸을 채우기 위해 사소하거나 억지스러운 문제를 만들지 말 것. 정말 없으면 빈 배열로 둘 것.
- "입력이 너무 짧거나 무의미함"은 이 단계에서 판단하지 않는다(백엔드 길이 검증이 선행 차단). 따라서 짧다는 이유만으로 issues를 비우지 말 것. 짧은 입력이라도 분석은 정상 수행하고, 문제가 있으면 기록할 것.
- snippet은 반드시 [원본 프롬프트]에 실제로 등장하는 문자열 그대로 인용할 것. 지어내거나 의역하지 말 것 (원본에 없는 snippet은 백엔드에서 자동 폐기됨).
- id는 issues 배열 내에서 유일해야 한다 (i1, i2, i3... 중복 금지).
- missing_constraints의 id도 배열 내에서 유일해야 한다 (mc1, mc2, mc3... 중복 금지). issues의 id와 같은 값을 재사용하지 말 것.
- missing_constraints의 confidence가 low인데 suggested_value나 suggested_phrase를 채우는 것은 "없는 조건을 확정값처럼 제시"하는 것과 같다 — 절대 금지. low는 반드시 null, options로만 답할 것.

[카테고리 정의 — 우선순위 순]

★ CODE_DUMP (코드 전체 전송) — 비개발자 토큰 낭비의 최대 원인
  대량의 코드를 통째로 붙여넣음. 보통 에러 위치와 메시지만 필요.
  예: 200줄 전체 + "고쳐줘" → 해당 줄 + 에러 메시지만으로 충분.

  [replacement 생성 규칙] 코드 본문은 절대 삭제·요약·축약·수정하지 않는다. verbatim
  그대로(문자 하나도 안 바꾸고) replacement 안에 포함시킨다 — 다음 턴에서 실제로
  코드를 고치려면 원본이 반드시 남아 있어야 하기 때문이다. 축약 대상은 코드가 아니라
  코드를 둘러싼 장황한 텍스트다(에러 스택 트레이스 원문, 재현용으로 붙인 중복 호출부 등).
  - 에러 메시지가 함께 있으면: 에러 원인 + 관련 함수를 한 줄로 진단하고
    "[진단] {{한 줄 진단}}" 뒤에 빈 줄을 두고 원본 코드를 그대로 이어붙인다.
  - 에러 메시지가 없으면: 코드가 무엇을 하는지 한 줄로 설명하고
    "[코드 설명] {{한 줄 설명}}" 뒤에 빈 줄을 두고 원본 코드를 그대로 이어붙인다.
  - 어투는 설명형 명사구. "~해주세요" 요청 어투를 쓰지 않는다(원칙 7의 예외).
  - 진단하다가 버그로 보이는 부분을 발견해도 그 수정 사항을 코드 블록 안에 직접
    반영해서 보여주지 말 것. 수정 제안은 오직 "[진단]" 한 줄 텍스트로만 말로 설명하고,
    그 아래 이어붙이는 코드는 원본과 100% 동일해야 한다. 이 카테고리는 UI에서 사용자가
    코드를 검토·수정할 방법이 없어(무조건 그대로 반영됨), 코드를 몰래 고쳐서 보여주면
    사용자가 알아채지 못한 채 바뀐 코드가 다음 요청에 그대로 들어간다.
    금지 예: "HAVING total > 100000"을 진단하면서 "HAVING SUM(amount) > 100000"으로
    슬쩍 고쳐서 보여주는 것 — 고쳐야 한다는 것 자체는 [진단] 문구로만 말할 것.
  - 코드 안에 질문과 무관해 보이는 부분이 섞여 있어도 제외 여부가 불확실하면 전부
    유지한다 — 정보 손실이 토큰 절감보다 항상 우선한다.

★ MONOLITHIC_REQUEST (분할 없는 통합 요청) — 비개발자 특유의 패턴
  단계적으로 만들어야 할 복잡한 개발을 한 번에 통째로 요청.
  LLM이 오류 많은 미완성 전체를 생성해 디버깅·재요청 토큰이 폭증함.
  처방: 논리적 개발 순서로 분할하고 첫 단계부터 진행하도록 optimized를 재구성.

  [발동 조건] "독립적으로 동작·검증 가능한 기능"이 3개 이상일 때만 발동.
  판별 테스트: 한 항목만 단독으로 완성해도 사용자가 의미 있게 확인·사용할 수
  있으면 '독립 기능'. 다른 항목 없이는 무의미하면 '단일 기능의 하위 요소' → 발동 안 함.

  주의(구현 레이어 함정): "폼 UI 작성 → 입력 검증 → 서버 전송 → 응답 처리"처럼
  하나의 기능을 만들 때 항상 거치는 일반적인 구현 단계를 나열한 것은 "독립 기능
  여러 개"가 아니라 "기능 하나를 구현하는 순서"다. 요청에 만들려는 대상이 하나뿐이면
  (예: 회원가입 하나), 그걸 구현하는 데 필요한 레이어가 몇 개든 발동하지 않는다.

  발동 O: "할 일 추가 + 완료 체크 + 삭제 + 저장" (각 동작이 독립적으로 확인 가능)
  발동 X: "다크모드 토글 + 설정 유지 + 전환 효과" → 모두 '다크모드' 하나의 구현 요소
  발동 X: "회원가입 입력 + 중복확인 + 형식검증 + 해시저장" → 모두 '회원가입' 단일 기능
  발동 X: "회원가입 폼 + 입력 검증 + 서버 저장" → 구현 레이어 나열(위 주의 참고). '회원가입'
    하나를 만드는 과정일 뿐, 로그인·게시판처럼 서로 다른 기능이 여러 개인 게 아니다.

  UNSTRUCTURED와 구분: UNSTRUCTURED는 요구가 "정리 안 됨"(번호화로 해결),
  MONOLITHIC_REQUEST는 독립 기능을 "한 번에 구현"하라는 것 자체가 문제(단계 분할로 해결).

  [steps 생성 규칙] 발동 시 반드시 steps 배열을 채운다(3~6개).
  - title: 짧은 단계명. 최종 프롬프트 문구 조립에 쓰이는 재료이므로 명사구로.
  - desc: 1문장 설명. 계획 미리보기에만 쓰이고 최종 문구에는 안 들어감.
  - verify: 이 단계가 "끝났다"를 무엇으로 확인할지 구체적 방법 1문장(예: "테스트 계정으로
    로그인 성공/실패 메시지가 뜨는지 확인"). desc와 마찬가지로 미리보기 전용이며 최종
    문구에는 안 들어감. 완료 기준이 없으면 사용자가 결과를 못 미더워 다시 물어보게 되고,
    그게 곧 이 카테고리가 막으려는 "재작업"이므로 반드시 채운다.

★ UNSTRUCTURED (흩어진 요구사항)
  여러 요구가 줄글로 섞여 LLM이 우선순위·관계를 추론해야 함.
  예: "A도 해주고 B도 하고 C도" → 번호 리스트화 필요.

  [replacement 생성 규칙] snippet(흩어진 요구 전체)을 번호 리스트로 재구성해서 그대로 대체한다.
  예: "A도 해주고 B도 하고 C도" → "1) A 2) B 3) C". 사용자 선택 없이 그 자리에서 바로 바뀌는
  단순 치환이다(MONOLITHIC_REQUEST처럼 단계를 나눠 순차 진행시키는 게 아님 — 그냥 정리만 함).

★ MISSING_CONSTRAINT (출력 조건 누락) — issues가 아니라 missing_constraints 배열에 기록
  표현은 이해되나 필수 스펙(언어/버전/형식/길이)이 빠짐.
  예: "코드 짜줘" → 어떤 언어인지 미지정.

  [confidence 판정 기준]
  - high: 원문 안에 확실한 단서가 있음 (예: 붙여넣은 코드가 이미 Python이라 언어가 확정적)
  - rec: 단서는 없지만 업계 표준·상식적인 기본값이 있음 (예: 언어 미지정 시 Python)
  - low: 단서도 표준값도 없는 순수 취향/선택 사항 (예: 반응형 브레이크포인트 기준)

  high/rec는 suggested_value(짧은 값)와 suggested_phrase(완성 문장)를 반드시 채운다.
  low는 suggested_value/suggested_phrase를 절대 채우지 말고(null), options로 2~4개
  선택지를 제시한다. 확신 없는 값을 확정값처럼 제시하는 것은 "없는 조건 조작"이다.

- AMBIGUOUS (모호한 지시어 또는 위임형)
  지시어: "이거", "그거", "다", "전부" / 위임형: "알아서", "적당히", "잘 해줘"
  MISSING_CONSTRAINT와 구분: AMBIGUOUS는 표현 자체가 두루뭉술, MISSING_CONSTRAINT는 표현은 이해되나 스펙 누락.

- REDUNDANT (중복 표현)
  같은 요구를 다른 말로 반복. 예: "에러 처리도 하고 예외 처리도 꼭" → 동일 요구 2회.

- FILLER (의미 없는 군더더기)
  "혹시", "일단", "그냥", "되게", "~해주실 수 있나요"
  보수적으로만 정리. 의미가 바뀔 위험이 있으면 그대로 둘 것.

[최적화 원칙]
1. 의미는 절대 바꾸지 말 것. 사용자 의도 보존이 최우선.
2. 단순 입력에 강제로 구조·제약을 추가하지 말 것. optimized가 원본보다 길어지면 안 됨.
3. 임의로 도구·수치·버전을 확정하지 말 것. "(예: ...)" 또는 "[입력 필요]" 사용.
4. "혹시", "가능하시다면"은 제거하되, "~해주세요" 같은 정중함은 유지.
5. 코드 덤프는 코드 본문을 절대 삭제·요약·수정하지 말 것. 버그로 보이는 부분을
   발견해도 코드 자체는 문자 하나 건드리지 말고, 진단 문구만 코드 위에 텍스트로
   덧붙일 것. 코드는 verbatim 그대로 보존할 것 (원본이 사라지거나 몰래 바뀌면
   사용자가 모르는 채 다음 턴에 변경된 코드가 그대로 들어감).
6. 여러 기능을 한 번에 요청한 경우(MONOLITHIC_REQUEST), optimized는 전체를 한꺼번에
   만들라고 하지 말 것. 의존성에 따라 단계로 나눈 뒤, "한 단계씩 완성하며 각 단계가
   동작하는지 확인하고 다음으로 진행"하도록 지시하고 "첫 단계부터 시작"하라고 명시할 것.
   단계 순서는 일반적 개발 흐름(데이터·구조 → 핵심 기능 → 부가 기능 → 스타일)을
   따르되 도메인에 맞게 구성. 단계는 3~6개 이내.
7. optimized는 "사용자가 LLM에게 보내는 요청문"이다. LLM이 사용자에게
응답하는 말투를 절대 쓰지 말 것.
- 금지: "~해주시면 진행하겠습니다", "~알려주세요", "확인했습니다"
- 누락된 정보(코드/파일 등)는 "[입력 필요]" 또는 "(아래에 코드 첨부)"로 표시.
8. "(예: ...)", "[입력 필요]", "~등"은 사용자의 선택권을 열어둔 의도된 장치다.
이를 "확정하라"고 지적하지 말 것. 이미 올바른 처리다.

이제 위 입력 프롬프트를 분석하여 JSON으로만 응답하세요."""
            }
        ]
    )

    # Step 4: 응답 파싱
    try:
        print("Claude 응답:", message.content[0].text)
        response_text = message.content[0].text.strip()
        start = response_text.find("{")
        end = response_text.rfind("}") + 1
        if start != -1 and end != 0:
            response_text = response_text[start:end]
        result = json.loads(response_text)
    except (json.JSONDecodeError, IndexError):
        return {
            "error": "최적화 실패. 다시 시도해주세요.",
            "original_tokens": original_tokens,
        }

    # Step 5: 최적화 후 토큰 수 계산
    optimized_tokens = count_tokens(result["optimized"])
    saved_tokens = original_tokens - optimized_tokens
    saved_percent = round((saved_tokens / original_tokens) * 100, 1) if original_tokens > 0 else 0

    # Step 6: 비용 계산
    costs = calculate_costs(original_tokens, optimized_tokens)

    # Step 7: 카테고리별 가이드 매칭 + v5 스키마 필드 보정 + snippet 원본 검증
    issues_with_guides = []
    seen_snippets = {}  # occurrence 자동 계산용 (0-based)
    seen_ids = set()
    fallback_id_counter = 0

    for issue in result.get("issues", []):
        # snippet 원본 검증: 실제로 원본 프롬프트에 없으면 드롭 (환각 방지)
        snippet = issue.get("snippet") or ""  # snippet:null 대응 — get()의 default는 키가 없을 때만 적용되고 값이 None이면 안 먹음
        if not snippet:
            continue  # snippet 자체가 없으면(원래 null이었던 경우 포함) 이 issue는 의미 없음, 드롭

        # "…"로 잘린 snippet은 verbatim이 아니라 프론트 indexOf가 못 찾음 — 말줄임표만 벗겨내고 재비교
        snippet_clean = snippet.rstrip("…").strip()
        if snippet in prompt:
            pass  # 그대로 사용
        elif snippet_clean and snippet_clean in prompt:
            snippet = snippet_clean
        else:
            # 정확 매칭도, "…" 제거 매칭도 실패 — 마지막으로 공백류(개행·탭·연속 스페이스)
            # 차이만 있는지 확인. MONOLITHIC_REQUEST/UNSTRUCTURED처럼 snippet이 여러 줄에
            # 걸치는 카테고리에서, 모델이 원본의 줄바꿈을 공백으로 재현해 이슈 전체가
            # 조용히 드롭되던 문제가 실측으로 확인됨 — find_verbatim이 원본에서 실제
            # 매칭되는 정확한 부분(개행 포함)을 찾아준다. 그마저 실패하면 환각으로 보고 드롭.
            verbatim = find_verbatim(snippet_clean or snippet, prompt)
            if not verbatim:
                continue
            snippet = verbatim
        issue["snippet"] = snippet

        category = issue.get("category", "")
        guide = GUIDES.get(category, {})

        # id: 없거나 중복이면 백엔드가 새로 부여 (배열 인덱스 대신 안정적 참조용)
        issue_id = issue.get("id")
        if not issue_id or issue_id in seen_ids:
            # 앞 항목이 이미 i1을 쓰고 있을 수 있으므로 비어 있는 번호가 나올 때까지 증가
            fallback_id_counter += 1
            while f"i{fallback_id_counter}" in seen_ids:
                fallback_id_counter += 1
            issue_id = f"i{fallback_id_counter}"
        seen_ids.add(issue_id)
        issue["id"] = issue_id

        # v5 스키마 필드 기본값 보정 (Claude가 필드를 빠뜨렸을 경우 대비)
        issue.setdefault("scope", infer_scope(category))
        issue.setdefault("replacement", None)
        if category != "MONOLITHIC_REQUEST":
            issue["steps"] = None  # MONOLITHIC 아니면 항상 null로 고정

        # CODE_DUMP verbatim 강제: 모델이 진단하다가 버그로 보이는 부분을 코드 안에서
        # 직접 "고쳐서" 보여주는 경우가 실측됨(예: SQL HAVING 절 alias를 슬쩍 수정) —
        # 프롬프트 지시만으로는 완전히 막지 못해(N=8 중 4회 재현) 백엔드가 강제한다.
        # 진단 문구(첫 "\n\n" 앞부분)만 모델 것을 살리고, 그 뒤 코드는 모델 출력을
        # 신뢰하지 않고 이미 원본 검증을 마친 snippet으로 무조건 치환한다.
        if category == "CODE_DUMP" and issue["replacement"]:
            diagnosis, sep, _ = issue["replacement"].partition("\n\n")
            if sep:
                issue["replacement"] = diagnosis + "\n\n" + snippet

        # occurrence: 동일 snippet 등장 순서 자동 계산 (0-based)
        issue["occurrence"] = seen_snippets.get(snippet, 0)
        seen_snippets[snippet] = seen_snippets.get(snippet, 0) + 1

        # MISSING_CONSTRAINT는 issues에 오지 않는다(별도 missing_constraints 배열, 아래 Step 7-1).
        # 혹시 프롬프트 드리프트로 여기 섞여 들어와도 스키마가 다르므로 issues에 넣지 않고 버린다.
        if category == "MISSING_CONSTRAINT":
            continue
        source = attach_source(category, f"{snippet} {issue.get('explanation', '')}")
        issues_with_guides.append({**issue, "guide": guide, "source": source})

    # Step 7-1: missing_constraints 검증 + 조작 방지 가드
    missing_constraints = []
    seen_mc_ids = set()
    mc_fallback_id_counter = 0

    for mc in result.get("missing_constraints", []):
        if not mc.get("field"):
            continue  # field 없는 항목은 의미 없음, 드롭

        # id: 없거나 중복이면 백엔드가 새로 부여 (issues와 동일한 패턴, 접두사만 mc로 구분)
        # 접두사가 mc가 아닌 값(예: 모델이 i1을 뱉는 드리프트)도 재부여 — issues id와 섞이면 안 됨
        mc_id = mc.get("id")
        if not mc_id or not str(mc_id).startswith("mc") or mc_id in seen_mc_ids:
            # 앞 항목이 이미 mc1을 쓰고 있을 수 있으므로 비어 있는 번호가 나올 때까지 증가
            mc_fallback_id_counter += 1
            while f"mc{mc_fallback_id_counter}" in seen_mc_ids:
                mc_fallback_id_counter += 1
            mc_id = f"mc{mc_fallback_id_counter}"
        seen_mc_ids.add(mc_id)
        mc["id"] = mc_id

        confidence = mc.get("confidence")
        if confidence not in ("high", "rec", "low"):
            confidence = "low"  # 알 수 없는 값이면 가장 보수적으로 취급

        if confidence == "low":
            # "없는 조건 조작 금지" 원칙 — low인데 값이 와도 백엔드가 강제로 비움
            mc["suggested_value"] = None
            mc["suggested_phrase"] = None
        else:
            mc.setdefault("options", None)

        mc["confidence"] = confidence
        mc["source"] = attach_source("MISSING_CONSTRAINT", f"{mc['field']} {mc.get('suggested_phrase') or ''}")
        missing_constraints.append(mc)

    # Step 8: 긍정 피드백
    feedback = None
    if len(issues_with_guides) == 0 and len(missing_constraints) == 0:
        feedback = "✅ 잘 작성된 프롬프트예요! 개선할 부분이 없습니다."

    # Step 9: 로그인한 유저면 히스토리 자동 저장
    if authorization and authorization.startswith("Bearer "):
        try:
            token = authorization.replace("Bearer ", "")
            payload = decode_token(token)
            if payload.get("type") == "access":
                user_id = int(payload.get("sub"))
                category_tally = {}
                for iss in issues_with_guides:
                    cat = iss.get("category")
                    if cat:
                        category_tally[cat] = category_tally.get(cat, 0) + 1
                db = SessionLocal()
                try:
                    history = PromptHistory(
                        user_id=user_id,
                        original_prompt=prompt,
                        optimized_prompt=result["optimized"],
                        original_tokens=original_tokens,
                        optimized_tokens=optimized_tokens,
                        saved_tokens=saved_tokens,
                        saved_percent=saved_percent,
                        issue_count=len(issues_with_guides),
                        categories=category_tally or None,
                        diagnosis_detail={
                            "issues": issues_with_guides,
                            "missing_constraints": missing_constraints,
                            "feedback": feedback,
                        },
                    )
                    db.add(history)
                    db.commit()
                finally:
                    db.close()
        except Exception:
            pass  # 히스토리 저장 실패해도 optimize 결과는 정상 반환

    return {
        "original_tokens": original_tokens,
        "optimized_tokens": optimized_tokens,
        "saved_tokens": saved_tokens,
        "saved_percent": saved_percent,
        "optimized_prompt": result["optimized"],
        "issues": issues_with_guides,
        "missing_constraints": missing_constraints,
        "feedback": feedback,
        "costs": costs,
    }