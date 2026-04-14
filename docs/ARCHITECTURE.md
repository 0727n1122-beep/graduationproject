# 시스템 아키텍처

## 파이프라인
사용자 프롬프트 입력
│
▼
[tiktoken] 원본 토큰 수 정밀 측정
│
▼
[LangChain Step 1] 문제점 분석
│
▼
[LangChain Step 2] 프롬프트 최적화
│
▼
[LangChain Step 3] 품질 평가
│
▼
[tiktoken] 최적화 후 토큰 수 재측정
│
▼
비용 비교 + 분석 리포트 출력
