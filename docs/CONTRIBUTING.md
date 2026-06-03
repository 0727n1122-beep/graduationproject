# 기여 가이드

## 개발 환경
- Node.js 18 이상
- Python 3.9 이상 (tiktoken, anthropic 사용)

## 실행 방법

### 1. 레포 클론
```bash
git clone https://github.com/0727n1122-beep/graduationproject.git
cd graduationproject
```

### 2. 프론트엔드 실행
```bash
cd frontend
npm install
npm run dev
# http://localhost:3000 접속
```

### 3. 백엔드 실행
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
# http://localhost:8000/docs 접속
```

## 브랜치 전략
- `main` — 안정 버전
- `dev` — 개발 중인 기능
- `feature/*` — 개별 기능 브랜치
