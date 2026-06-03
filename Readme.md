# Minifi 
> 비개발자를 위한 AI 코딩 비용 절감 도구

**Efficiency, Optimization, Clarity**

바이브 코딩을 하는 비개발자가 LLM에 보내는 프롬프트의 낭비 패턴을 자동으로 감지하고,
최적화된 버전과 모델별 예상 비용을 비교해주는 웹 서비스입니다.

<div align="center">

![Project Status](https://img.shields.io/badge/status-in%20development-yellow)
![Team](https://img.shields.io/badge/team-10-blue)
![License](https://img.shields.io/badge/license-MIT-green)

</div>


## 🔗 배포 링크
- **서비스**: https://amused-clarity-production-ef3e.up.railway.app/
- **백엔드 API**: https://graduationproject-production-14f7.up.railway.app/docs

---

## 👥 팀 소개
**스타트 10팀 212223**

| 이름 | 역할 |
|------|------|
| 고윤진 (2176018) | Frontend, Team Leader |
| 이유진 (2376218) | Backend, AI |
| 김나현 (2276040) | 메타프롬프트/QA, PM |

---

## 💡 기획 배경
바이브 코딩 커뮤니티에서 "34M tokens for a small project", "300M tokens for a day?" 같은 사례가 속출하고 있습니다.
비개발자가 LLM에 코딩을 맡길 때 토큰이 낭비되는 주요 원인은 세 가지입니다.

- **처음부터 완성본 요청**: 전체 프로그램을 한 번에 요구 → 사소한 수정에도 전체 재생성
- **모호한 요청 반복**: "조금 더 고쳐줘" → 엉뚱한 수정 → 재요청 반복
- **출력 조건 누락**: 필요한 것을 명시하지 않음 → AI가 불필요한 것까지 친절하게 생성

---

## ✨ 핵심 기능

### 1. 감지 — 낭비 패턴 자동 탐지
7개 카테고리로 프롬프트 문제점을 분류합니다.

| 카테고리 | 설명 |
|----------|------|
| AMBIGUOUS | 모호한 지시어 ("이거", "알아서") |
| FILLER | 의미 없는 군더더기 ("혹시", "좀") |
| REDUNDANT | 중복 표현 |
| UNSTRUCTURED | 흩어진 요구사항 |
| CODE_DUMP | 코드 전체 전송 |
| MISSING_CONSTRAINT | 출력 조건 누락 |
| MONOLITHIC_REQUEST | 분할 없는 통합 요청 |

### 2. 최적화 — 프롬프트 재구성
큰 요청을 작고 실행 가능한 단계로 재구성합니다.

### 3. 비교 — 토큰·비용 시각화
- tiktoken 기반 Before/After 토큰 수 정밀 측정
- 7개 모델 (Claude Opus/Sonnet/Haiku, GPT-4o/mini, Gemini Pro/Flash) 비용 비교 차트

### 4. 가르친다 — 학습 피드백
- 왜 낭비인지 카테고리별 설명
- 다음번 작성 방법 가이드 제공
- 잘 작성된 프롬프트는 "Top-Quality Prompt" 긍정 피드백

---

## 🏗️ 시스템 구조

| 구성 요소 | 기술 | 역할 |
|-----------|------|------|
| **Frontend** | Next.js / Railway | 프롬프트 입력 UI, Before/After 시각화, 비용 비교 차트 |
| **Backend** | FastAPI / Railway | 룰 기반 차단, tiktoken 토큰 계산, 7모델 비용 계산 |
| **AI** | Claude API (Haiku) | 7개 카테고리 진단, 프롬프트 최적화, JSON 반환 |

**데이터 흐름**

```
사용자 → 프롬프트 입력
       → [Frontend] POST /optimize 요청
       → [Backend] Step1 룰 기반 차단 → tiktoken 계산 → Claude API 호출
       → [Claude] 카테고리 진단 + 최적화 → JSON 반환
       → [Backend] 비용 계산 → 결과 반환
       → [Frontend] Before/After 시각화 + 비용 비교 차트 렌더링
```
---

## 🛠️ 기술 스택

| 구분 | 기술 |
|------|------|
| Frontend | Next.js, Railway |
| Backend | FastAPI (Python), Railway |
| AI | Claude API (claude-haiku-4-5-20251001) |
| 토큰 계산 | tiktoken (cl100k_base) |
| 메타프롬프트 | v1 → v4 자체 개발 |

---

## 📊 구현 결과

- **단일 프롬프트 절감**: 최대 20.6% 절감 실측 (435 → 123 tokens)
- **MONOLITHIC_REQUEST**: 단계 분할로 장기적 재프롬프팅 루프 감소
- **QA**: 30개 이상 테스트 완료, 코딩/데이터 분석 도메인 카테고리 진단 일관성 확인

---

## ⚠️ 한계 및 향후 개선 방향

**현재 MVP 기준 3가지 한계**

1. **토큰 절감률 실측 실험 진행 중** — 실제 사용자 프롬프트 기반 A/B 실험 미수행
2. **경량 LLM 전처리 미구현** — 최종 설계: Gemma 등 경량 모델 선구조화 → MVP에서는 Claude 단독 처리
3. **실사용자 테스트 필요** — 비개발자의 바이브 코딩 환경에서 효율 개선 검증 필요

**향후 로드맵**

- Phase 01: A/B 실험 및 토큰 절감률 실측 (100개+ 프롬프트 수집)
- Phase 02: 경량 LLM 전처리 도입 (Gemma 2B 선구조화)
- Phase 03: 실사용자 테스트 및 정식 서비스 론칭

---

## 📅 발표
- 일시: 2026년 6월 11일
- 팀: 스타트 10팀 212223
- 지도교수: 심재형 교수님
