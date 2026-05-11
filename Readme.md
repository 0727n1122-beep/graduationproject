# 프롬프트 자동 최적화 기반 LLM API 비용 실시간 비교 웹 서비스

> AI 기반 LLM API 비용 사전 비교 플랫폼

<div align="center">

![Project Status](https://img.shields.io/badge/status-in%20development-yellow)
![Team](https://img.shields.io/badge/team-10-blue)
![License](https://img.shields.io/badge/license-MIT-green)

</div>

## 목차

- [프로젝트 소개](#-프로젝트-소개)
- [팀원](#-팀원)
- [프로젝트 배경](#-프로젝트-배경)
- [용어 설명](#-용어-설명)
- [주요 기능](#-주요-기능)
- [기술 스택](#-기술-스택)
- [시작하기](#-시작하기)
- [프로젝트 구조](#-프로젝트-구조)
- [기여하기](#-기여하기)
- [라이선스](#-라이선스)

## 프로젝트 소개

|항목          |내용                                                                           |
|------------|-----------------------------------------------------------------------------|
|**프로젝트명**   |프롬프트 자동 최적화 기반 LLM API 비용 실시간 비교 웹 서비스                                       |
|**한줄 설명**   |바이브 코딩을 하는 비전공자가 LLM 사용 시 발생하는 토큰 낭비를 줄이고, 모델별 예상 비용을 한눈에 비교할 수 있는 웹 서비스|
|**프로젝트 키워드**|LLM 비용 비교, API 토큰 계산, 프롬프트 최적화                                               |
|**타겟 고객**   |Claude Code, Cursor, Replit 등 AI 코딩 도구를 사용하는 비전공자. 토큰이 무엇인지 모르고 쓰다가 예상보다 높은 비용에 당황하는 사람들                                |

## 팀원

**Team 10**

| 이름 | 역할 |
|------|------|
| 고윤진 | 팀장, 프론트엔드 |
| 이유진 | 백엔드, AI |
| 김나현 | PM, 서포트 |

## 프로젝트 배경

### 문제 인식

바이브 코딩의 확산으로 비전공자들도 LLM을 활용해 개발하는 시대가 됐습니다.
하지만 비전공자들은 프롬프트 작성법을 몰라서 다음과 같은 문제를 겪습니다.

- 전체 문제를 한 번에 해결하려는 포괄적인 프롬프트를 작성해서 AI가 의도를 잘못 파악함
- 오류가 나도 코드를 이해 못해서 오류 메시지를 그냥 복붙하는 재프롬프팅 루프에 빠짐
- 토큰에 대한 이해도가 없어 filler 단어 남발 등 비효율적인 사용으로 토큰 낭비
- 토큰 사용량이 시각적으로 제공되지 않아 본인이 얼마나 낭비하는지 알 수 없음

### 우리의 솔루션

사용자가 프롬프트를 입력하면, 입력된 프롬프트를 자동 최적화하고, 각 AI 모델(GPT-4, Gemini, Claude 등)의 예상 비용을 실시간으로 계산하고 비교하는 웹 서비스를 제공합니다.

## 용어 설명

|용어                           |설명                                                                     |
|-----------------------------|-----------------------------------------------------------------------|
|**토큰(Token)**                |AI가 텍스트를 처리하는 단위. 대략 한글 1글자 = 2~3토큰, 영어 1단어 = 1~2토큰. AI 요금은 ‘토큰 수’로 계산됨|
|**LLM(Large Language Model)**|GPT-4, Gemini, Claude 같은 대형 언어 AI 모델의 총칭                               |
|**프롬프트(Prompt)**             |AI에게 보내는 질문이나 명령문. 예: ‘이 글을 요약해줘’ 같은 입력값                               |

## 주요 기능

### 핵심 기능

#### 1. 프롬프트 자동 최적화

- 사용자가 입력한 프롬프트를 비용적으로 최적화
- 불필요한 토큰 제거 및 효율적인 표현으로 변환
- 의미는 유지하면서 토큰 수를 최소화

#### 2. 실시간 비용 계산 및 비교

- 최적화된 프롬프트로 각 LLM 모델의 예상 토큰 수 자동 계산
- **비교 카드 UI** 제공
  
  ```
  Gemini: 800원
  GPT-4: 1,200원
  Claude: 950원
  ```
- 가장 저렴한 옵션 하이라이트

#### 3. 프롬프트 작성 가이드
- 비개발자가 자주 저지르는 5가지 안티패턴 BAD/GOOD 예시 제공
- 명확한 목표 설정, 군더더기 제거, 구조화된 요청 등 가이드

### 기말 목표 기능

- 임의의 프롬프트에 대한 실시간 최적화 (현재는 예시 프롬프트 기반)
- tiktoken 기반 정밀 토큰 계산
- 자체 개발한 한국어 filler word 감지 엔진
- Claude API 실제 연동

 
## 구현 현황
 
> 중간 점검 기준 (2026-05)
 
| 기능 | 상태 | 비고 |
|------|------|------|
| 프롬프트 입력 UI | ✅ 완료 | Vercel 배포 완료 |
| 비용 비교 카드 UI | ✅ 완료 | GPT-4 / Gemini / Claude 3종 |
| 프롬프트 작성 가이드 | ✅ 완료 | 5가지 안티패턴 예시 |
| 글자 수 기반 토큰 추정 | ✅ 완료 | 데모용 추정식 |
| 프롬프트 자동 최적화 | 🔄 진행중 | 예시 프롬프트 기반 동작 |
| tiktoken 정밀 토큰 계산 | 🔄 진행중 | 기말 목표 |
| FastAPI 백엔드 연동 | 🔄 진행중 | 기말 목표 |
| Claude API 실제 연동 | ⏳ 미완료 | 기말 목표 |
| 한국어 filler word 감지 엔진 | ⏳ 미완료 | 기말 목표 |
 
---

## 기술 스택


| 구분 | 기술 |
|------|------|
| **Frontend** | HTML, CSS, JavaScript, React.js, TailwindCSS |
| **Backend** | Node.js (데모), FastAPI Python (기말 목표) |
| **AI/LLM** | tiktoken, LangChain, LLMLingua (기말 목표) |
| **토큰 계산** | 글자 수 기반 추정식 (데모), tiktoken (기말 목표) |
| **DB** | Firebase Firestore (기말 목표) |
| **외부 API** | OpenAI API, Anthropic Claude API, Google AI SDK (기말 목표) |
| **배포** | Vercel (프론트), Railway or Render (백엔드, 기말 목표) |
 


## 시작하기

### 필수 요구사항

- Node.js (v18 이상)
- Git

### 설치 및 실행

```bash
# 1. Repository 클론
git clone https://github.com/0727n1122-beep/graduationproject.git
cd graduationproject

# 2. 데모 실행
node src/demo.mjs

# 3. 브라우저에서 접속
# http://localhost:3000

```
 
### 환경변수 설정
 
API 연동 기능 사용 시 `.env` 파일이 필요합니다. 아래 `.env.example`을 참고해 `.env`를 생성하세요.
 
```bash
cp .env.example .env
```
 
```env
# .env.example
OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
GOOGLE_AI_API_KEY=your_google_ai_api_key_here
```
 
> ⚠️ `.env` 파일은 절대 커밋하지 마세요. `.gitignore`에 포함되어 있습니다.
 

## 프로젝트 구조

```
graduationproject/
├── src/
│   └── demo.mjs   # 프로토타입 데모 (Node.js 단일 파일)
├── docs/           # 문서
├── PMF.md          # 경쟁 제품 분석 및 차별성
├── Readme.MD       # 프로젝트 소개
└── LICENSE         # MIT 라이선스
```

## 기여하기

프로젝트에 기여

1. 이 저장소를 Fork
1. Feature 브랜치를 생성 (`git checkout -b feature/AmazingFeature`)
1. 변경사항을 커밋 (`git commit -m 'Add some AmazingFeature'`)
1. 브랜치에 Push (`git push origin feature/AmazingFeature`)
1. Pull Request를 생성

## 라이선스

This project is licensed under the MIT License - see the <LICENSE> file for details.

## 문의

프로젝트에 대한 질문이나 제안사항이 있으면 이슈 등록하기

-----

<div align="center">

**LLM API 비용, 이제 미리 비교하고 절약하세요!**

Made by Team 10

</div>
