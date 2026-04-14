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

## 기술 스택

| 구분 | 기술 | 용도 |
|------|------|------|
| 토큰 분석 | tiktoken | 모델별 정확한 토큰 수 측정 |
| 프롬프트 관리 | LangChain PromptTemplate | 재사용 가능한 프롬프트 구조화 |
| 워크플로우 | LangChain SequentialChain | 분석→최적화→평가 체이닝 |
| 프론트엔드 | Vanilla HTML/CSS/JS | 단일 파일 UI |
| 백엔드 | Node.js HTTP 내장 모듈 | 제로 의존성 서버 |
