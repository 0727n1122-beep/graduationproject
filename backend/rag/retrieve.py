"""
런타임 검색 모듈 (하이브리드) — 프롬프트 전체를 코퍼스 전체와 비교하는 순수 의미
검색은 코퍼스가 작을 때(청크 6개) 부정확했음(범용적인 청크가 항상 상위를 차지함).

대신 이미 백엔드가 판별한 이슈 카테고리로 먼저 후보 청크를 좁히고(각 청크는
chunks.json에 어떤 카테고리에 쓸모 있는지 미리 태그돼 있음), 후보가 여러 개일
때만 그 안에서 유사도로 순위를 매긴다.
  - 카테고리에 맞는 청크가 0개 → 근거 없음(빈 리스트). FILLER/REDUNDANT가 이 경우.
  - 1개 → 그대로 반환. 임베딩 호출 자체가 필요 없음(UNSTRUCTURED/CODE_DUMP).
  - 2개 이상 → 이슈의 snippet+explanation을 임베딩해서 후보끼리만 비교.

corpus.json이 아직 없거나 VOYAGE_API_KEY가 없거나 API 호출이 실패해도, 전체
서비스가 죽지 않도록 빈 리스트를 반환한다 — RAG 근거 없이도 기존 진단은 동작.
"""
import json
import math
import os

import requests
from dotenv import load_dotenv

VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings"
MODEL = "voyage-multilingual-2"

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CORPUS_PATH = os.path.join(BASE_DIR, "corpus.json")

# main.py가 이미 로드하지만, 이 모듈만 단독으로 쓰일 때도 안전하도록 방어적으로 로드
# (load_dotenv는 이미 설정된 환경변수를 덮어쓰지 않으므로 중복 호출해도 무해함)
load_dotenv(os.path.join(BASE_DIR, "..", ".env"))


def _load_corpus():
    if not os.path.exists(CORPUS_PATH):
        return []
    with open(CORPUS_PATH, encoding="utf-8") as f:
        return json.load(f)


_CORPUS = _load_corpus()  # 서버 시작 시 1회 로드


def _cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def _embed(text: str, input_type: str, api_key: str) -> list[float]:
    res = requests.post(
        VOYAGE_API_URL,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json={"input": [text], "model": MODEL, "input_type": input_type},
        timeout=6,  # 근거 인용은 부가 기능이라, 느리면 빨리 포기하고 진단 자체를 지연시키지 않음
    )
    res.raise_for_status()
    return res.json()["data"][0]["embedding"]


def retrieve_for_issue(category: str, query_text: str, top_k: int = 2) -> list[dict]:
    """이슈 카테고리에 맞는 근거 청크를 반환. 후보가 여러 개일 때만 임베딩 API를 호출한다."""
    candidates = [c for c in _CORPUS if category in c.get("categories", [])]
    if not candidates:
        return []  # 이 카테고리엔 근거 없음 (FILLER/REDUNDANT 등) — 정직하게 빈 결과
    if len(candidates) <= top_k:
        return candidates  # 후보가 top_k 이하면 순위 매길 필요 없이 그대로 반환

    api_key = os.getenv("VOYAGE_API_KEY")
    if not api_key:
        return candidates[:top_k]  # 키 없으면 순위 없이 앞에서부터 잘라 반환(안전한 폴백)

    try:
        query_vec = _embed(query_text, "query", api_key)
    except Exception:
        return candidates[:top_k]  # API 실패해도 진단 자체는 계속 진행

    # 후보 청크의 임베딩은 build_embeddings.py가 이미 corpus.json에 계산해 저장해둔 값을
    # 그대로 씀 — 쿼리 하나만 새로 임베딩하면 되므로 API 호출이 최소화됨(호출 1회/이슈).
    scored = [(c, _cosine(query_vec, c["embedding"])) for c in candidates]
    scored.sort(key=lambda pair: pair[1], reverse=True)
    return [c for c, _ in scored[:top_k]]
