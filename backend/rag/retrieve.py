"""
런타임 검색 모듈 — corpus.json(청크+임베딩)을 서버 시작 시 한 번 메모리에 올려두고,
매 /optimize 요청마다 사용자 프롬프트를 임베딩해서 코사인 유사도로 가장 관련 있는
청크 top-K를 반환한다.

corpus.json이 아직 없거나(build_embeddings.py 미실행) VOYAGE_API_KEY가 없으면,
전체 서비스가 죽지 않도록 빈 리스트를 반환한다 — RAG 근거 없이도 기존 진단은 그대로 동작.
"""
import json
import math
import os

import requests

VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings"
MODEL = "voyage-multilingual-2"

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CORPUS_PATH = os.path.join(BASE_DIR, "corpus.json")


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


def _embed_query(text: str, api_key: str) -> list[float]:
    res = requests.post(
        VOYAGE_API_URL,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json={"input": [text], "model": MODEL, "input_type": "query"},
        timeout=15,
    )
    res.raise_for_status()
    return res.json()["data"][0]["embedding"]


def retrieve(prompt: str, top_k: int = 3) -> list[dict]:
    """사용자 프롬프트와 의미적으로 가장 가까운 가이드 청크 top-K를 반환.
    corpus가 비어 있거나 키가 없으면 빈 리스트(안전한 폴백)."""
    if not _CORPUS:
        return []
    api_key = os.getenv("VOYAGE_API_KEY")
    if not api_key:
        return []

    try:
        query_vec = _embed_query(prompt, api_key)
    except Exception:
        return []  # 임베딩 API 실패해도 진단 자체는 계속 진행

    scored = [(_cosine(query_vec, chunk["embedding"]), chunk) for chunk in _CORPUS]
    scored.sort(key=lambda x: x[0], reverse=True)
    return [chunk for _, chunk in scored[:top_k]]
