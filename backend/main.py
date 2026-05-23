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
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
    # Step 2: 룰 기반 filler word 제거
    FILLER_WORDS = [
        "안녕하세요", "안녕히세요", "감사합니다", "감사해요", "고마워요",
        "혹시", "혹시나", "일단", "그냥", "좀", "좀더", "약간",
        "가능하시다면", "가능하면", "가능하다면", "부탁드립니다", "부탁해요",
        "해주세요", "해주실 수 있나요", "해주실 수 있으신가요",
        "알려주세요", "알려주실 수 있나요", "알려주실 수 있으신가요",
        "아 그리고", "아 맞다", "아 참", "그리고", "근데", "그런데",
        "이거", "이것", "그거", "저거", "뭐", "왜", "어떻게",
        "엄청", "진짜", "완전", "너무", "정말", "매우",
    ]
    
    cleaned_prompt = prompt
    for filler in FILLER_WORDS:
        cleaned_prompt = cleaned_prompt.replace(filler, "")
    
    # 여러 공백 정리
    import re
    cleaned_prompt = re.sub(r'\s+', ' ', cleaned_prompt).strip()

    # 원본 토큰 수 계산
    original_tokens = count_tokens(prompt)
    
    # Step 2 적용 후 토큰 수
    cleaned_tokens = count_tokens(cleaned_prompt)

    # Claude API 호출
    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1024,
        messages=[
            {
                "role": "user",
                "content": f"""당신은 LLM 프롬프트 최적화 전문가입니다.
아래 프롬프트를 분석하여 JSON으로만 응답하세요. 백틱이나 마크다운 없이 순수 JSON만.

[원본 프롬프트]
{cleaned_prompt}

[응답 형식]
{{
  "optimized": "최적화된 프롬프트 전문 (한국어)",
  "issues": [
    {{
      "category": "AMBIGUOUS|FILLER|REDUNDANT|UNSTRUCTURED|CODE_DUMP|MISSING_CONSTRAINT",
      "snippet": "원본에서 문제가 된 부분 (30자 이내)",
      "explanation": "왜 토큰 낭비인지 한 문장 (50자 이내)"
    }}
  ],
  "score_before": 0,
  "score_after": 0
}}

[출력 규칙 — 절대 준수]
- 순수 JSON 객체만 출력. 백틱(```), "json" 표시, 설명 문장, 인사말 일절 금지.
- 응답의 첫 글자는 {{, 마지막 글자는 }} 여야 합니다.
- 모든 문자열은 큰따옴표("")로 감싸고, 내부 큰따옴표는 \\" 로 이스케이프하세요.
- issues 배열은 최소 0개, 최대 5개. 가장 중요한 문제부터 나열하세요.
- 입력이 비어있거나 10자 미만이면 issues를 빈 배열로 두고 optimized는 원본 그대로 두세요.
- score_after는 반드시 optimized 기준으로 산출하세요.

[카테고리 정의 및 예시]
- AMBIGUOUS (모호한 지시어 또는 위임형 표현)
  - 지시어: "이거", "그거", "저거", "다", "전부"
  - 위임형: "알아서", "적당히", "잘 해줘", "알아서 잘 해주실 수 있죠?"
  예: "이거 좀 고쳐줘" → 무엇을 어떻게 고칠지 불명확

- AMBIGUOUS vs MISSING_CONSTRAINT 구분 기준
  - AMBIGUOUS: 표현 자체가 모호하거나 위임형인 경우
  - MISSING_CONSTRAINT: 표현은 이해되나 필요한 스펙이 아예 빠진 경우

- FILLER (의미 없는 군더더기)
  "아", "음", "그", "혹시", "일단", "그냥", "좀", "되게", "자꾸", "~해주실 수 있나요"
  예: "아 그리고 혹시 가능하시다면 해주세요" → 의미 없는 토큰 다수

- REDUNDANT (중복 표현): 같은 요구를 다른 말로 반복
  예: "에러 처리도 하고 예외 처리도 꼭 해줘" → 동일 요구 2회

- UNSTRUCTURED (흩어진 요구사항): 여러 요구가 번호/구조 없이 나열
  예: "A도 하고 B도 하고 그리고 C도" → 리스트화 필요

- CODE_DUMP (코드 전체 전송): 50줄 이상의 코드를 통째로 붙여넣음
  예: 200줄 코드 전체 + "고쳐줘" → 에러 부분만 보내면 됨

- MISSING_CONSTRAINT (출력 조건 누락): 언어, 형식, 길이, 버전 등 제약 미지정
  예: "코드 짜줘" → 어떤 언어인지, 함수인지 클래스인지 등 미지정

[점수 산정 기준]
- 90~100: 명확, 구체적, 구조화됨, 군더더기 없음
- 70~89: 의미 전달은 되나 1~2개 개선점 있음
- 50~69: 여러 문제 혼재, 재작성 권장
- 30~49: 모호하거나 군더더기 다수
- 0~29: 의미 불분명, 거의 사용 불가

[최적화 원칙]
1. 의미는 절대 바꾸지 말 것.
2. 모호한 표현은 일반적으로 의도될 법한 구체적 표현으로 대체.
3. 여러 요구사항은 번호 리스트로 구조화.
4. 출력 조건이 누락된 경우, 임의의 수치나 도구를 확정하지 말 것.
   반드시 "(예: Python 3.12)" 형태로 제안하거나 "[입력 필요]" 플레이스홀더로 처리.
5. 정중한 표현("~해주세요")은 유지하되, "혹시", "가능하시다면" 같은 우회 표현은 제거.
6. optimized는 반말로 작성할 것. 존댓말 금지.
7. optimized 작성 완료 후 해당 텍스트를 기준으로 score_after를 산출할 것.

이제 위 입력 프롬프트를 분석하여 JSON으로만 응답하세요."""
            }
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

    return {
        "original_tokens": original_tokens,
        "optimized_tokens": optimized_tokens,
        "saved_tokens": saved_tokens,
        "saved_percent": saved_percent,
        "optimized_prompt": result["optimized"],
        "issues": issues_with_guides,
        "score_before": result.get("score_before", 0),
        "score_after": result.get("score_after", 0),
        "costs": costs,
    }