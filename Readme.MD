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
|**한줄 설명**   |사용자가 입력한 프롬프트를 비용적으로 최적화한 뒤 ChatGPT, Gemini 등 각 LLM의 예상 API 비용을 한눈에 비교해주는 서비스|
|**프로젝트 키워드**|LLM 비용 비교, API 토큰 계산, 프롬프트 최적화                                               |
|**타겟 고객**   |AI API를 사용하는 학생, 개발자, 스타트업, 기획자 등 비용에 민감한 사용자                                |

## 팀원

**Team 10**

- 고윤진
- 김나현
- 이유진

## 프로젝트 배경

### 문제 인식

ChatGPT, Gemini, Claude 등 AI 모델이 쏟아지면서 개발 시 어떤 모델을 선택할지 고민하는 상황이 많아졌습니다. 성능도 중요하지만 **비용 또한 매우 중요한 요소**입니다.

- API형 AI 모델들은 토큰 단위로 과금
- 각 회사마다 요금 체계가 달라서 실제로 내 프롬프트를 돌리면 **얼마가 나오는지 미리 알기가 어려움**
- 프롬프트 최적화 없이 사용 시 불필요한 비용 발생

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

#### 3. 가격 정보 자동 업데이트

- LLM별 가격 DB 자동 업데이트 기능
- 최신 요금제 반영
- 정확한 비용 예측 제공

### 부가 기능

#### 1. 월간 사용량 대시보드

- API 호출 내역을 누적하여 통계 제공
- “이번달 GPT-4에 얼마 썼어요, 이렇게 바꾸면 OO만원 아낄 수 있어요” 형태의 리포트 생성
- 비용 절감 인사이트 제공

#### 2. 프롬프트 템플릿 저장소

- 사용자가 자주 쓰는 프롬프트를 저장
- 저장된 프롬프트의 월간 예상 비용 미리 계산
- 재사용 가능한 프롬프트 라이브러리

#### 3. 예산 알림

- 사용자가 설정해둔 월별 예산 초과 시 알림
- Slack 또는 이메일로 알림 발송
- 비용 관리 자동화

## 기술 스택

### Frontend

- React
- HTML/CSS/TypeScript

### Backend

- Node.js

### Tools & Collaboration

- GitHub
- Git

### APIs

- OpenAI API (GPT-4)
- Google Gemini API
- Anthropic Claude API

## 시작하기

### 필수 요구사항

- Node.js (v14 이상)
- npm 또는 yarn
- Git

### 설치 및 실행

```bash
# 1. Repository 클론
git clone https://github.com/your-username/llm-cost-optimizer.git
cd llm-cost-optimizer

# 2. 의존성 설치
npm install

# 3. 환경 변수 설정
cp .env.example .env
# .env 파일에 API 키 등 필요한 정보 입력

# 4. 개발 서버 실행
npm run dev

# 5. 브라우저에서 접속
# http://localhost:3000
```

### 환경 변수 설정

`.env` 파일에 다음 정보를 입력하세요:

```env
OPENAI_API_KEY=your_openai_api_key
GEMINI_API_KEY=your_gemini_api_key
CLAUDE_API_KEY=your_claude_api_key
```

## 프로젝트 구조

```
llm-cost-optimizer/
├── src/
│   ├── components/        # React 컴포넌트
│   ├── services/          # API 서비스
│   ├── utils/             # 유틸리티 함수
│   └── styles/            # CSS 파일
├── public/                # 정적 파일
├── docs/                  # 문서
├── tests/                 # 테스트 파일
├── package.json
└── README.md
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
