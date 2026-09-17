"""
RAG 코퍼스 빌드 스크립트 — chunks.json의 각 청크를 Voyage AI로 임베딩해서
corpus.json(청크 + 벡터)을 만든다. 문서가 안 바뀌는 한 이 스크립트는 딱 한 번만
실행하면 되고, 서비스 운영 중(요청마다)에는 다시 호출하지 않는다.

사용법:
    export VOYAGE_API_KEY=pa-...
    python3 rag/build_embeddings.py
"""
import json
import os
import sys

import requests

VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings"
MODEL = "voyage-multilingual-2"  # 영어 가이드 문서 vs 한국어 사용자 프롬프트를 매칭해야 해서 다국어 모델 사용

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CHUNKS_PATH = os.path.join(BASE_DIR, "chunks.json")
CORPUS_PATH = os.path.join(BASE_DIR, "corpus.json")


def embed_texts(texts: list[str], api_key: str) -> list[list[float]]:
    res = requests.post(
        VOYAGE_API_URL,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json={"input": texts, "model": MODEL, "input_type": "document"},
        timeout=30,
    )
    res.raise_for_status()
    data = res.json()["data"]
    # Voyage는 요청 순서대로 index를 매겨 반환하므로 index로 정렬해 순서를 보장
    ordered = sorted(data, key=lambda d: d["index"])
    return [d["embedding"] for d in ordered]


def main():
    api_key = os.getenv("VOYAGE_API_KEY")
    if not api_key:
        print("VOYAGE_API_KEY 환경변수가 없습니다. export VOYAGE_API_KEY=pa-... 후 다시 실행하세요.", file=sys.stderr)
        sys.exit(1)

    with open(CHUNKS_PATH, encoding="utf-8") as f:
        chunks = json.load(f)

    texts = [c["text"] for c in chunks]
    print(f"{len(texts)}개 청크 임베딩 생성 중 (model={MODEL})...")
    embeddings = embed_texts(texts, api_key)

    corpus = []
    for chunk, embedding in zip(chunks, embeddings):
        corpus.append({**chunk, "embedding": embedding})

    with open(CORPUS_PATH, "w", encoding="utf-8") as f:
        json.dump(corpus, f, ensure_ascii=False)

    print(f"완료: {CORPUS_PATH} 에 {len(corpus)}개 청크(임베딩 포함) 저장됨.")


if __name__ == "__main__":
    main()
