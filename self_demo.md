# Minifi Self-Demo 가이드

## 서비스 소개
바이브 코딩을 하는 비전공자를 위한 LLM 프롬프트 최적화 및 비용 비교 웹 서비스.
프롬프트의 문제점을 자동으로 감지하고, 최적화된 버전과 모델별 예상 비용을 제공합니다.

## 서비스 URL
https://amused-clarity-production-ef3e.up.railway.app/

## 백엔드 API 직접 테스트
https://graduationproject-production-14f7.up.railway.app/docs

---

## 따라해보기

### S1. 이메일 정리 요청 (REDUNDANT · UNSTRUCTURED · FILLER)

아래 프롬프트를 입력창에 붙여넣고 **최적화하기** 버튼을 누르세요.
```
이메일 내용을 좀 요약해주고 그리고 핵심 내용도 뽑아주고 그리고 또 중요한 부분도 강조해줬으면 좋겠어
아 그리고 이메일 제목도 만들어줘 핵심만 추려서
```
**확인할 것:**
- `FILLER` — "좀", "그리고"×4, "아 그리고" 감지
- `REDUNDANT` — 요약/핵심/중요한 부분이 같은 요구 3회 반복으로 감지
- `UNSTRUCTURED` — 요구 4개가 줄글로 연결된 것 감지
- 최적화 후 번호 리스트로 구조화된 결과 확인
- 토큰 절감 그래프 및 모델별 비용 비교 확인

---

### S2. 잘 작성된 프롬프트 — 긍정 피드백
```
1 이메일 내용을 요약해줘
2 핵심만 뽑아서 답장을 작성해줘
```

**확인할 것:**
- 발견된 문제점 없음
- 긍정 피드백 카드 ("Recognized as Top-Quality Prompt") 표시
- Minifi는 이미 잘 작성된 프롬프트는 그대로 유지함

---

### S3. React 다크모드 추가 (FILLER · AMBIGUOUS · MISSING_CONSTRAINT)
```제가 만든 React 앱에 그 뭐냐 다크모드 기능을 좀 추가하고 싶은데요 지금 코드가 좀 복잡한 상태인데 그래도 알아서 잘 해주실 수 있죠? 
   근데 또 너무 많이 바꾸지는 말아주시고 그냥 살짝만 바꿔주세요 그리고 사용자가 토글로 바꿀 수 있게 하고 싶고 또 새로고침해도 유지되면 좋겠어요
   음 그리고 가능하면 부드럽게 전환되는 효과도 있으면 좋고요
```
**확인할 것:**
- `FILLER` — "그 뭐냐", "좀"×2, "알아서 잘 해주실 수 있죠?", "음 그리고" 감지
- `AMBIGUOUS` — "살짝만 바꿔주세요" 기준 불명확으로 감지
- `MISSING_CONSTRAINT` — React 버전, CSS 방식 미지정으로 감지
- 최적화 후 `[입력 필요]` 플레이스홀더로 선택권 보존된 것 확인

---

### S4. 코드 오류 수정 + 코드 덤프 (CODE_DUMP · AMBIGUOUS)

아래 프롬프트와 코드를 함께 붙여넣고 최적화하기 버튼을 누르세요.
```
이거 돌리니까 자꾸 이상해 결과가 제대로 안 나와 좀 봐줘
const express = require('express');
const app = express();
const port = 3000;
let users = [
{ id: 1, name: '김철수', email: 'kim@test.com' },
{ id: 2, name: '이영희', email: 'lee@test.com' },
];
app.use(express.json());
app.get('/users/:id', (req, res) => {
const user = users.find(u => u.id === req.params.id);
if (!user) {
return res.status(404).json({ error: 'User not found' });
}
res.json(user);
});
app.listen(port, () => {
console.log(Server running on port ${port});
});
```

**확인할 것:**
- `CODE_DUMP` — 코드 전체 전송 패턴 감지
- `AMBIGUOUS` — "이거", "이상해", "제대로 안 나와" 모호한 표현 감지
- 최적화 후 오류 발생 위치·에러 메시지만 보내도록 안내하는 것 확인
- 토큰 절감 효과 그래프 확인

---

## 주의사항
- 5자 미만 입력 시 에러 반환 (정상 동작)
- 5000자 초과 입력 시 에러 반환 (정상 동작)
- Claude API 응답 시간에 따라 3~10초 소요될 수 있음
