# API 테스트 케이스 정리

## 테스트 환경
- 백엔드: FastAPI (localhost:8000)
- AI 모델: claude-haiku-4-5-20251001
- 날짜: 2026-05-19

---

## ✅ 정상 작동 케이스

### 1. filler word 가득한 프롬프트
**입력:**
> 안녕하세요 혹시 가능하시다면 파이썬으로 웹 스크래핑 하는 방법 좀 알려주실 수 있으신가요? 감사합니다

**결과:**
- original_tokens: 53
- FILLER, UNSTRUCTURED, MISSING_CONSTRAINT 감지
- score: 15 → 82

---

### 2. 코드 덩어리 붙여넣기 (CODE_DUMP)
**입력:**
> 이 코드 고쳐줘 def hello(): print('hello') pritn('world') hello()

**결과:**
- original_tokens: 27
- CODE_DUMP, UNSTRUCTURED, MISSING_CONSTRAINT 감지
- score: 15 → 82

---

### 3. 정상적인 프롬프트
**입력:**
> Python으로 CSV 파일을 읽어서 데이터를 분석하는 코드를 작성해줘

**결과:**
- original_tokens: 23
- AMBIGUOUS, MISSING_CONSTRAINT, UNSTRUCTURED 감지
- score: 25 → 85

---

## ⚠️ 개선 필요한 케이스

### 1. 최적화 후 토큰이 오히려 늘어나는 경우
**원인:** Claude가 구조화하면서 오히려 더 길고 명확한 프롬프트를 생성함

**대응 방안:**
- saved_tokens이 마이너스인 경우 "토큰은 늘었지만 품질이 향상됐습니다" 메시지 표시
- 발표 때 "단순 토큰 절감이 아닌 재프롬프팅 루프 감소"로 설명

### 2. JSON 파싱 실패 (수정 완료)
**원인:** Claude 응답 안에 코드블록이 중첩될 경우 파싱 실패
**해결:** `{` 부터 `}` 까지만 추출하는 방식으로 수정

---

## 📋 5/21 미팅 논의 사항

- [ ] 메타 프롬프트 v2 개선 방향
- [ ] score 계산 기준 명확화 (현재 Claude가 임의로 결정)
- [ ] saved_tokens 마이너스 케이스 UI 처리 방식
- [ ] 카테고리 6개 최종 확정
- [ ] API 응답 JSON 스펙 최종 확정