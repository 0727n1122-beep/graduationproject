# 평가 파이프라인 파일럿

원본 프롬프트 vs Minifi 첨삭본으로 각각 한 파일짜리 HTML 결과물을 생성해서,
벤치마크별 기능 체크리스트를 Playwright로 자동 채점하고 비교한다.

## 준비

```bash
cd backend
source venv/bin/activate   # 팀에서 쓰는 가상환경
pip install -r requirements.txt
pip install -r eval/requirements.txt
playwright install chromium
```

`backend/.env`에 `ANTHROPIC_BASE_URL` / `ANTHROPIC_API_KEY`가 있어야 하고,
`/optimize`를 호출할 백엔드가 떠 있어야 함 (기본값 `http://localhost:8000`,
배포된 주소로 돌리고 싶으면 `EVAL_API_URL` 환경변수로 덮어쓰기).

## 실행

```bash
cd backend/eval
python run_pilot.py                                       # benchmarks/ 안 전부, 조건별 1회
python run_pilot.py --runs 5                              # 전부, 조건별 5회씩
python run_pilot.py --runs 5 benchmarks/resume_page.json  # 하나만
```

같은 프롬프트로도 생성 결과가 매번 달라서 한 번 돌린 결과로는 원본/첨삭본 우열을
말할 수 없음 — 비교 결론을 낼 때는 `--runs 5` 이상으로 돌릴 것. 첨삭본도 반복마다
`/optimize`를 새로 호출함.

결과는 `results/`에 저장됨:
- `<스펙id>_<조건>_r<회차>.html` — 생성된 결과물
- `<스펙id>_<조건>_r<회차>_desktop.png` / `_mobile.png` — 상호작용 전 첫 화면 스크린샷(1280px / 375px)
- `summary.json` — 회차별 채점 결과 + 조건별 집계(평균·최소·최대 충족률, 항목별 통과 횟수, 평균 출력 토큰)
- `report.html` — 조건별 집계와 원본/첨삭본 스크린샷을 나란히 보여주는 비교 리포트.
  A/B 통과 횟수가 다른 체크 항목은 노란색으로 표시됨. API 호출 없이 리포트만
  다시 만들려면 `python report.py`.

## 멀티턴 평가 (`run_multiturn.py`)

실제로는 결과물을 써보고 안 되는 걸 다시 요청하므로, "몇 번 다시 요청해야 완성되나"를 잼.

```bash
python run_multiturn.py --runs 5 --max-turns 5            # 전부
python run_multiturn.py --runs 5 benchmarks/todo_app.json  # 하나만
```

1. 첫 요청: A는 원본, B는 `/optimize` 첨삭본. 첨삭본에 `[입력 필요]` 빈칸이 있으면 원래
   요청만 아는 가상 사용자(LLM)가 원래 의도 범위 안에서 채움(실제 서비스에서 사용자가 하는 일).
   새 요구를 추가하지 않도록 지시하고, 채운 결과는 summary에 남겨 검토 가능.
2. 생성 → 체크리스트 채점 → 실패 항목이 있으면 각 항목의 고정 불평 문장(`complaint`)을
   묶어 다음 메시지로 보내고 고친 HTML을 받음. 불평 문장은 A/B가 똑같음.
3. 전 항목 통과 또는 `--max-turns`까지 반복.

측정: 재질문 횟수(전 항목 통과까지 보낸 후속 요청 수), 완성률, 대화 토큰(모든 턴의 입력+출력 —
이전 대화가 쌓이므로 재질문 1번이 토큰을 크게 늘림). 결과는 `results/multiturn/`.

체크 항목마다 `complaint`(사용자가 써보고 할 법한 불평, 해결책이 아니라 증상만)가 있어야 함.

## 벤치마크 목록 (13개)

- 짧은 요청 10개: 이력서, 할 일 목록, 계산기, 챗봇 UI, 날씨 위젯, 레시피, 설문조사, 요금제, 블로그, 로그인
- **엉킨 요청 3개** (`expense_tracker`, `signup_form`, `stopwatch`): 인사말·하소연·같은 요구
  반복·흩어진 요구·여러 기능 한꺼번에가 섞인, 실제 비개발자가 쓸 법한 긴 요청.
  Minifi가 원래 겨냥하는 상황이라 따로 집계해서 볼 것.

## 벤치마크 스펙 추가하는 법

`benchmarks/*.json` 형식으로 하나 추가:

```json
{
  "id": "todo_app",
  "name": "할 일 목록 앱",
  "original_prompt": "비개발자 말투로 쓴 원본 프롬프트",
  "checklist": [
    { "id": "c1_add", "description": "[명시] 적고 추가하면 목록에 나타난다",
      "actions": [
        { "type": "fill", "selector": "input[type='text']", "value": "우유 사기" },
        { "type": "click", "selectors": ["button:has-text('추가')", "button"] }
      ],
      "type": "text_contains_any", "texts": ["우유 사기"] },
    { "id": "c6_persist", "description": "[암묵] 새로고침해도 남아 있다",
      "actions": [ "...추가 후", { "type": "reload" } ],
      "type": "text_contains_any", "texts": ["우유 사기"] }
  ]
}
```

### 체크리스트 설계 원칙: [명시] + [암묵]

체크리스트를 원본 프롬프트에 **적힌 것만**(명시)으로 채우면 원본으로 만들어도 다
통과해서 첨삭 효과가 측정되지 않음(실제로 그랬음). 그래서 항목을 두 종류로 섞음:

- **[명시]** 원본 프롬프트에 적힌 요구 (체크하면 줄 긋기, 일주일치 예보 등)
- **[암묵]** 말은 안 했지만 비개발자가 당연히 기대하고, 빠지면 "다시 해줘"로
  이어지는 것 (새로고침해도 유지, 0.1+0.2=0.3, 빈 칸 제출 막기, 휴대폰에서 안 깨짐 등)

**[암묵] 항목은 Minifi 첨삭 결과를 보지 않고** "사용자가 당연히 기대할 것" 기준으로
정함 — 첨삭본에 맞춰 체크리스트를 고르면 결과를 짜맞추는 셈이 되므로.
항목 설명 앞의 [명시]/[암묵] 태그로 리포트에서 구분됨.

### 체크 타입 (`checks.py`)

`element_exists` / `element_count_min` / `text_contains_any` / `text_regex` /
`text_regex_count_min` / `text_or_value_regex` / `computed_style_any` / `js` / `not` / `any_of`

- `text_contains_any`/`text_regex`는 **렌더링된 본문 텍스트만** 봄 — `<style>`/`<script>`,
  `placeholder` 같은 속성, `<input>` 값은 안 잡힘. 계산기 표시창처럼 입력창 값까지
  봐야 하면 `text_or_value_regex`.
- 취소선·정렬처럼 "보이는 스타일"은 `computed_style_any` — 클래스명·인라인 style·
  `input:checked ~ span` 같은 CSS 선택자 등 구현 방식과 무관하게 실제 적용된 스타일로 판정.
- `js`는 `expr`(JS, `return`으로 참/거짓)을 평가. `not`은 안쪽 체크가 실패하면 통과.

### 행동 테스트 (`actions`)

체크 항목에 `actions`가 있으면 **그 항목만 새 페이지**를 열어 액션을 실행한 뒤 채점함
(항목끼리 상태가 섞이지 않음). 액션이 하나라도 실패하면(버튼이 없음 등) 그 항목은 실패.

액션 타입: `fill` / `click` / `press`(`selector` 또는 우선순위 목록 `selectors`) /
`click_text`(텍스트가 정확히 일치하는 버튼 — 계산기 `"7"`, `"+"`) /
`expect_text`(중간 단계 확인, 없으면 실패) / `js`(상태 저장 등) / `reload` / `wait` / `set_viewport`

`alert`/`confirm`은 페이지 로드 전에 `window.__dialogs`에 기록되도록 바꿔둠 —
"빈 칸 제출 시 경고" 같은 반응을 `js` 체크에서 확인할 수 있고 채점이 막히지 않음.
스펙 최상위 `setup_actions`는 `actions`가 없는 항목들이 공유하는 페이지에 한 번 실행됨.

새 [암묵] 항목을 추가하면 실제 생성 HTML 몇 개로 돌려서 **실패가 진짜 기능 누락인지**
(체크가 구현 방식 차이를 못 잡은 거짓 실패가 아닌지), **통과가 진짜인지**를 꼭 확인할 것.
