from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
import tiktoken

router = APIRouter(prefix="/simulate", tags=["simulate"])

# ── 토큰 계산 ──────────────────────────────────────────────
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

def calculate_costs(total_tokens: int) -> dict:
    """누적 토큰 기준 모델별 비용 계산
    시뮬레이션이라 출력 토큰량은 입력과 동일하다고 가정 -> input/output 가격 모두 반영"""
    costs = {}
    for model, price in MODELS.items():
        input_cost = (total_tokens / 1_000_000) * price["input"]
        output_cost = (total_tokens / 1_000_000) * price["output"]
        costs[model] = round(input_cost + output_cost, 6)
    return costs

# ── 요청/응답 스키마 ───────────────────────────────────────
class SimulateRequest(BaseModel):
    original_prompt: str
    optimized_prompt: str
    turns: Optional[int] = 5  # 기본 5회 멀티턴

class PerTurn(BaseModel):
    turn: int
    original_tokens: int
    optimized_tokens: int
    cumulative_original: int
    cumulative_optimized: int

class SimulateResponse(BaseModel):
    turns: int
    original_total_tokens: int
    optimized_total_tokens: int
    saved_tokens: int
    saved_percent: float
    per_turn: list[PerTurn]
    costs_original: dict
    costs_optimized: dict

# ── 엔드포인트 ─────────────────────────────────────────────
@router.post("", response_model=SimulateResponse)
def simulate(request: SimulateRequest):
    """
    멀티턴 토큰 시뮬레이션
    - 실제 Claude 호출 없이 tiktoken으로 계산
    - 최적화 전/후 프롬프트를 N번 반복 주고받을 때 누적 토큰 비교
    - 멀티턴 특성: 이전 대화가 컨텍스트로 누적되므로 매 턴마다 토큰이 쌓임
    """
    turns = max(1, min(request.turns or 5, 20))  # 1~20회 제한

    original_tokens_per_turn = count_tokens(request.original_prompt)
    optimized_tokens_per_turn = count_tokens(request.optimized_prompt)

    per_turn = []
    cumulative_original = 0
    cumulative_optimized = 0

    for i in range(1, turns + 1):
        # 멀티턴: 매 턴마다 이전 컨텍스트가 누적됨
        # 실제로는 이전 대화 전체가 입력으로 들어가므로 턴이 늘수록 토큰이 선형 증가
        cumulative_original += original_tokens_per_turn * i
        cumulative_optimized += optimized_tokens_per_turn * i

        per_turn.append(PerTurn(
            turn=i,
            original_tokens=original_tokens_per_turn * i,
            optimized_tokens=optimized_tokens_per_turn * i,
            cumulative_original=cumulative_original,
            cumulative_optimized=cumulative_optimized,
        ))

    saved_tokens = cumulative_original - cumulative_optimized
    saved_percent = round(saved_tokens / cumulative_original * 100, 1) if cumulative_original > 0 else 0

    return SimulateResponse(
        turns=turns,
        original_total_tokens=cumulative_original,
        optimized_total_tokens=cumulative_optimized,
        saved_tokens=saved_tokens,
        saved_percent=saved_percent,
        per_turn=per_turn,
        costs_original=calculate_costs(cumulative_original),
        costs_optimized=calculate_costs(cumulative_optimized),
    )