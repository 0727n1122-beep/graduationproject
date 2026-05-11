# CLAUDE.md — AI 팀원을 위한 프로젝트 가이드

> 이 파일은 Claude Code 등 AI 코딩 에이전트가 프로젝트를 빠르게 파악하고 작업할 수 있도록 작성된 가이드입니다.

---

## 프로젝트 개요

**서비스명:** 프롬프트 자동 최적화 기반 LLM API 비용 실시간 비교 웹 서비스  
**한줄 설명:** 비전공자가 LLM 사용 시 발생하는 토큰 낭비를 줄이고, 모델별 예상 비용을 한눈에 비교할 수 있는 웹 서비스  
**배포 URL:** https://graduationproject-murex.vercel.app

---

## 폴더 구조 및 역할

```
graduationproject/
├── README.md           # 프로젝트 전체 소개
├── CLAUDE.md           # AI 팀원 가이드 (현재 파일)
├── .env.example        # 환경변수 예시
├── package.json        # Node.js 의존성
├── src/
│   └── demo.mjs        # 현재 동작하는 프로토타입 (Node.js)
├── frontend/           # React.js + TailwindCSS 프론트엔드 (개발 예정)
├── backend/            # FastAPI Python 백엔드 (개발 예정)
├── ai/                 # 토큰 계산 및 프롬프트 최적화 엔진 (개발 예정)
├── docs/               # 기획 문서, 발표자료 등
└── PMF.md              # 경쟁 제품 분석
```

---

## 현재 구현 범위 (중간 점검 기준)

### 완료된 것
- `src/demo.mjs`: Node.js 기반 프로토타입 서버
- Vercel 배포 완료 (프론트엔드 정적 페이지)
- 비용 비교 카드 UI (GPT-4 / Gemini / Claude)
- 프롬프트 작성 가이드 (5가지 안티패턴)
- 글자 수 기반 토큰 추정식

### 진행 중
- 프롬프트 자동 최적화 (예시 프롬프트 기반)
- tiktoken 정밀 토큰 계산
- FastAPI 백엔드 연동

### 미완료 (기말 목표)
- Claude / OpenAI / Google AI API 실제 연동
- Firebase Firestore DB 연동
- 한국어 filler word 감지 엔진

---

## 실행 방법

```bash
# 프로토타입 데모 실행
git clone https://github.com/0727n1122-beep/graduationproject.git
cd graduationproject
node src/demo.mjs
# → http://localhost:3000 접속
```

---

## 환경변수

`.env.example`을 복사해서 `.env` 생성 후 키 입력:

```env
OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
GOOGLE_AI_API_KEY=your_google_ai_api_key_here
```

> ⚠️ `.env`는 절대 커밋 금지

---

## 기술 스택 요약

| 구분 | 기술 |
|------|------|
| Frontend | HTML, CSS, JS (데모) → React.js + TailwindCSS (기말) |
| Backend | Node.js (데모) → FastAPI Python (기말) |
| AI/토큰 | 추정식 (데모) → tiktoken + LLMLingua (기말) |
| DB | 없음 (데모) → Firebase Firestore (기말) |
| 배포 | Vercel |

---

## AI 작업 시 주의사항

- `src/demo.mjs`는 현재 유일하게 동작하는 파일이므로 **삭제 금지**
- 비용 계산 로직 수정 시 반드시 GPT-4 / Gemini / Claude 3가지 모델 모두 반영
- API 키는 `.env`에서만 관리, 코드에 하드코딩 금지
- 한국어 토큰 계산은 영어와 다름 (한글 1글자 ≈ 2~3토큰)
- `frontend/`, `backend/`, `ai/` 폴더는 기말까지 개발 예정 폴더이므로 임의로 구조 변경 금지

---

## 팀 정보

| 이름 | 역할 |
|------|------|
| 고윤진 | 팀장, 프론트엔드 |
| 이유진 | 백엔드, AI |
| 김나현 | PM, 문서화 |
