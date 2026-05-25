# PromptForge Backend

## 기술 스택
- FastAPI (Python)
- Anthropic Claude API
- tiktoken

## 시작하기

### 1. 가상환경 생성 및 활성화
```bash
python3 -m venv venv
source venv/bin/activate  # Mac
```

### 2. 패키지 설치
```bash
pip install -r requirements.txt
```

### 3. 환경변수 설정
```bash
cp .env.example .env
# .env 파일에 API 키 입력
```

### 4. 서버 실행
```bash
uvicorn main:app --reload
```

## API 엔드포인트

### GET /
서버 상태 확인

### POST /optimize
프롬프트 최적화 및 비용 비교

**Request**
```json
{
  "prompt": "최적화할 프롬프트 입력"
}
```

**Response**
```json
{
  "original_tokens": 96,
  "optimized_tokens": 113,
  "saved_tokens": -17,
  "saved_percent": -17.7,
  "optimized_prompt": "최적화된 프롬프트",
  "issues": [
    {
      "category": "FILLER",
      "snippet": "문제가 된 부분",
      "explanation": "왜 문제인지 설명"
    }
  ],
  "score_before": 32,
  "score_after": 85,
  "costs": {
    "claude-sonnet-4": {
      "before": 0.001749,
      "after": 0.002541
    }
  }
}
```

## 카테고리 설명

| 카테고리 | 설명 |
|---------|------|
| AMBIGUOUS | 모호한 지시 ("이거", "그거", "다 알려줘") |
| FILLER | 의미 없는 군더더기 ("혹시", "일단", "좀") |
| REDUNDANT | 중복 표현 |
| UNSTRUCTURED | 요구사항이 흩어져 있음 |
| CODE_DUMP | 코드를 통째로 붙여넣음 |
| MISSING_CONSTRAINT | 출력 형식, 제약 조건 누락 |

## 환경변수

| 변수 | 설명 |
|------|------|
| ANTHROPIC_API_KEY | Anthropic API 키 |
| ANTHROPIC_BASE_URL | LiteLLM 서버 URL (수업용) |