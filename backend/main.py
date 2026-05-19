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
아래 프롬프트를 분석하여 반드시 JSON으로만 응답하세요. 다른 텍스트는 절대 포함하지 마세요.

[원본 프롬프트]
{cleaned_prompt}

[응답 형식]
{{
  "optimized": "최적화된 프롬프트 전문",
  "issues": [
    {{
      "category": "AMBIGUOUS|FILLER|REDUNDANT|UNSTRUCTURED|CODE_DUMP|MISSING_CONSTRAINT",
      "snippet": "원본에서 문제가 된 부분",
      "explanation": "왜 이게 문제인지 한 문장"
    }}
  ],
  "score_before": 0에서100사이숫자,
  "score_after": 0에서100사이숫자
}}"""
            }
        ]
    )

    # 응답 파싱
    try:
        print("Claude 응답:", message.content[0].text)
        response_text = message.content[0].text.strip()
        # ```json ... ``` 제거
        if response_text.startswith("```"):
            response_text = response_text.split("```")[1]
            if response_text.startswith("json"):
                response_text = response_text[4:]
        result = json.loads(response_text.strip())
    except json.JSONDecodeError:
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

    return {
        "original_tokens": original_tokens,
        "optimized_tokens": optimized_tokens,
        "saved_tokens": saved_tokens,
        "saved_percent": saved_percent,
        "optimized_prompt": result["optimized"],
        "issues": result.get("issues", []),
        "score_before": result.get("score_before", 0),
        "score_after": result.get("score_after", 0),
        "costs": costs,
    }