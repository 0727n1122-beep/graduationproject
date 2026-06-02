from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import anthropic
import tiktoken
import os
import json

load_dotenv()

app = FastAPI()

# CORS 설정
import os

ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# Anthropic 클라이언트
client = anthropic.Anthropic(
    api_key=os.getenv("ANTHROPIC_API_KEY"),
    base_url=os.getenv("ANTHROPIC_BASE_URL"),
)

# 요청 모델
class PromptRequest(BaseModel):
    prompt: str

# 토큰 계산 함수
def count_tokens(text: str) -> int:
    enc = tiktoken.get_encoding("cl100k_base")
    return len(enc.encode(text))

# 모델별 비용 계산 (1M 토큰당 USD)
MODELS = {
    "claude-opus-4": {"input": 15, "output": 75},
    "claude-sonnet-4": {"input": 3, "output": 15},
    "claude-haiku-3-5": {"input": 0.8, "output": 4},
    "gpt-4o": {"input": 2.5, "output": 10},
    "gpt-4o-mini": {"input": 0.15, "output": 0.6},
    "gemini-2-5-pro": {"input": 1.25, "output": 10},
    "gemini-2-5-flash": {"input": 0.15, "output": 0.6},
}
# 카테고리별 가이드 사전
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

def calculate_costs(input_tokens: int, output_tokens: int) -> dict:
    costs = {}
    for model, price in MODELS.items():
        before = (input_tokens / 1_000_000) * price["input"] + \
                 (input_tokens * 2 / 1_000_000) * price["output"]
        after = (output_tokens / 1_000_000) * price["input"] + \
                (output_tokens * 2 / 1_000_000) * price["output"]
        costs[model] = {"before": round(before, 6), "after": round(after, 6)}
    return costs

@app.get("/")
def root():
    return {"status": "ok", "message": "PromptForge API"}

@app.post("/optimize")
async def optimize(request: PromptRequest):
    prompt = request.prompt
    # Step 1: 룰 기반 사전 차단
    if not prompt or not prompt.strip():
        return {"error": "프롬프트를 입력해주세요.", "code": "EMPTY_INPUT"}
    
    if len(prompt) > 5000:
        return {"error": "프롬프트가 너무 깁니다. 5000자 이하로 입력해주세요.", "code": "TOO_LONG"}
    
    if len(prompt.strip()) < 5:
        return {"error": "프롬프트가 너무 짧습니다.", "code": "TOO_SHORT"}

    # 원본 토큰 수 계산
    original_tokens = count_tokens(prompt)
    

    # Claude API 호출
    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=2048,
        messages=[
            {
                "role": "user",
"content": f"""당신은 LLM 프롬프트 최적화 전문가입니다. 비개발자가 작성한 복잡한 코딩·과제 프롬프트의 토큰 낭비를 줄이는 데 특화되어 있습니다.

[원본 프롬프트]
\"\"\"
{prompt}
\"\"\"

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
      "category": "AMBIGUOUS | FILLER | REDUNDANT | UNSTRUCTURED | CODE_DUMP | MISSING_CONSTRAINT | MONOLITHIC_REQUEST",
      "snippet": "문제가 된 부분만 발췌. 원문 전체를 그대로 넣지 말 것",
      "explanation": "왜 토큰, 비용 낭비로 이어지는지 간결하게(1-2문장)"
    }}
  ]
}}

[출력 규칙 — 절대 준수]
- 순수 JSON 객체만 출력. 백틱(```), "json" 표시, 설명 문장, 인사말 일절 금지.
- 응답의 첫 글자는 {{, 마지막 글자는 }}.
- issues 배열은 최소 0개, 최대 5개. 가장 중요한 문제부터.
- issues=[]는 "분석 결과 개선할 점이 없음"을 의미한다. 칸을 채우기 위해 사소하거나 억지스러운 문제를 만들지 말 것. 정말 없으면 빈 배열로 둘 것.
- "입력이 너무 짧거나 무의미함"은 이 단계에서 판단하지 않는다(백엔드 길이 검증이 선행 차단). 따라서 짧다는 이유만으로 issues를 비우지 말 것. 짧은 입력이라도 분석은 정상 수행하고, 문제가 있으면 기록할 것.

[카테고리 정의 — 우선순위 순]

★ CODE_DUMP (코드 전체 전송) — 비개발자 토큰 낭비의 최대 원인
  대량의 코드를 통째로 붙여넣음. 보통 에러 위치와 메시지만 필요.
  예: 200줄 전체 + "고쳐줘" → 해당 줄 + 에러 메시지만으로 충분.

★ MONOLITHIC_REQUEST (분할 없는 통합 요청) — 비개발자 특유의 패턴
  단계적으로 만들어야 할 복잡한 개발을 한 번에 통째로 요청.
  LLM이 오류 많은 미완성 전체를 생성해 디버깅·재요청 토큰이 폭증함.
  처방: 논리적 개발 순서로 분할하고 첫 단계부터 진행하도록 optimized를 재구성.

  [발동 조건] "독립적으로 동작·검증 가능한 기능"이 3개 이상일 때만 발동.
  판별 테스트: 한 항목만 단독으로 완성해도 사용자가 의미 있게 확인·사용할 수
  있으면 '독립 기능'. 다른 항목 없이는 무의미하면 '단일 기능의 하위 요소' → 발동 안 함.

  발동 O: "할 일 추가 + 완료 체크 + 삭제 + 저장" (각 동작이 독립적으로 확인 가능)
  발동 X: "다크모드 토글 + 설정 유지 + 전환 효과" → 모두 '다크모드' 하나의 구현 요소
  발동 X: "회원가입 입력 + 중복확인 + 형식검증 + 해시저장" → 모두 '회원가입' 단일 기능

  UNSTRUCTURED와 구분: UNSTRUCTURED는 요구가 "정리 안 됨"(번호화로 해결),
  MONOLITHIC_REQUEST는 독립 기능을 "한 번에 구현"하라는 것 자체가 문제(단계 분할로 해결).

★ UNSTRUCTURED (흩어진 요구사항)
  여러 요구가 줄글로 섞여 LLM이 우선순위·관계를 추론해야 함.
  예: "A도 해주고 B도 하고 C도" → 번호 리스트화 필요.

★ MISSING_CONSTRAINT (출력 조건 누락)
  표현은 이해되나 필수 스펙(언어/버전/형식/길이)이 빠짐.
  예: "코드 짜줘" → 어떤 언어인지 미지정.
  주의: 임의로 "Python"을 확정하지 말 것. "(예: Python 3.12)" 또는 "[입력 필요]" 사용.

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
5. 코드 덤프는 분리·요약 제안. 전체 코드를 그대로 보존하지 말 것.
6. 여러 기능을 한 번에 요청한 경우(MONOLITHIC_REQUEST), optimized는 전체를 한꺼번에
   만들라고 하지 말 것. 의존성에 따라 단계로 나눈 뒤, "한 단계씩 완성하며 각 단계가
   동작하는지 확인하고 다음으로 진행"하도록 지시하고 "첫 단계부터 시작"하라고 명시할 것.
   단계 순서는 일반적 개발 흐름(데이터·구조 → 핵심 기능 → 부가 기능 → 스타일)을
   따르되 도메인에 맞게 구성. 단계는 3~6개 이내.

이제 위 입력 프롬프트를 분석하여 JSON으로만 응답하세요."""            }
        ]
    )

    # 응답 파싱
    try:
        print("Claude 응답:", message.content[0].text)
        response_text = message.content[0].text.strip()
        # 첫 번째 { 부터 마지막 } 까지만 추출
        start = response_text.find("{")
        end = response_text.rfind("}") + 1
        if start != -1 and end != 0:
            response_text = response_text[start:end]
        result = json.loads(response_text)
    except (json.JSONDecodeError, IndexError):
        # JSON 파싱 실패 시 fallback
        return {
            "error": "최적화 실패. 다시 시도해주세요.",
            "original_tokens": original_tokens,
        }

    # 최적화 후 토큰 수 계산
    optimized_tokens = count_tokens(result["optimized"])
    saved_tokens = original_tokens - optimized_tokens
    saved_percent = round((saved_tokens / original_tokens) * 100, 1) if original_tokens > 0 else 0

    # 비용 계산
    costs = calculate_costs(original_tokens, optimized_tokens)

    # 카테고리별 가이드 매칭
    issues_with_guides = []
    for issue in result.get("issues", []):
        category = issue.get("category", "")
        guide = GUIDES.get(category, {})
        issues_with_guides.append({
            **issue,
            "guide": guide
        })

    # 긍정 피드백
    feedback = None
    if len(issues_with_guides) == 0:
        feedback = "✅ 잘 작성된 프롬프트예요! 개선할 부분이 없습니다."

    return {
        "original_tokens": original_tokens,
        "optimized_tokens": optimized_tokens,
        "saved_tokens": saved_tokens,
        "saved_percent": saved_percent,
        "optimized_prompt": result["optimized"],
        "issues": issues_with_guides,
        "feedback": feedback,
        "costs": costs,
    }