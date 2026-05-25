# 배포 후 테스트 시나리오

## 1. 서버 상태 확인
- GET `https://백엔드URL/` → `{"status": "ok"}` 응답 확인

## 2. 기본 최적화 테스트
POST `https://백엔드URL/optimize`
```json
{
  "prompt": "안녕하세요 혹시 파이썬으로 웹 스크래핑 하는 방법 좀 알려주실 수 있으신가요?"
}
```
**기대 결과:**
- 200 응답
- `optimized_prompt` 필드 존재
- `issues` 배열 존재
- `costs` 7개 모델 존재

## 3. Step 1 차단 테스트
```json
{ "prompt": "코드" }
```
**기대 결과:** `{"error": "프롬프트가 너무 짧습니다."}`

## 4. 빈 입력 테스트
```json
{ "prompt": "" }
```
**기대 결과:** `{"error": "프롬프트를 입력해주세요."}`

## 5. CODE_DUMP 테스트
```json
{
  "prompt": "이거 고쳐줘\ndef hello():\n    print('hello')\n    pritn('world')\nhello()"
}
```
**기대 결과:** `issues`에 `CODE_DUMP` 포함

## 6. CORS 테스트
- 프론트엔드에서 백엔드 API 호출 시 CORS 에러 없는지 확인

## 7. 응답 속도 테스트
- `/optimize` 응답 시간 5초 이내 확인

## 체크리스트
- [ ] 서버 정상 실행
- [ ] `/optimize` 정상 응답
- [ ] Step 1 차단 로직 작동
- [ ] CORS 에러 없음
- [ ] 7개 모델 비용 계산 정상
- [ ] 환경변수 정상 주입