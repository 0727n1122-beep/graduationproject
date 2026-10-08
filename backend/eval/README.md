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
python run_pilot.py                              # benchmarks/ 안 전부
python run_pilot.py benchmarks/resume_page.json   # 하나만
```

결과는 `results/<스펙id>_<조건>.html` + `results/summary.json`에 저장됨.

## 벤치마크 스펙 추가하는 법

`benchmarks/*.json` 형식으로 하나 추가:

```json
{
  "id": "todo_app",
  "name": "할 일 목록 앱",
  "original_prompt": "비개발자 말투로 쓴 원본 프롬프트",
  "setup_actions": [
    { "type": "fill", "selector": "input[type='text']", "value": "테스트 항목" },
    { "type": "click", "selector": "button" }
  ],
  "checklist": [
    { "id": "c1", "description": "...", "type": "element_count_min", "selector": "li", "min": 1 }
  ]
}
```

체크 타입은 `checks.py` 참고 (`element_exists` / `element_count_min` /
`text_contains_any` / `text_regex` / `text_regex_count_min` / `any_of`).
`text_contains_any`/`text_regex`는 **렌더링된 본문 텍스트만** 봄 —
`<style>`/`<script>` 내용이나 `placeholder` 같은 HTML 속성은 거기 안 잡히니,
그런 건 `element_exists`를 CSS 속성 선택자(`input[placeholder]`,
`[style*='line-through']`)로 써서 체크할 것.

`setup_actions`(선택)는 할 일 추가 후에만 체크박스/삭제 버튼이 생기는 앱처럼,
상호작용을 해야만 나타나는 기능을 채점 전에 미리 실행해둠(`fill`/`click`/`press`).
없으면 로드된 그대로(상호작용 없이) 채점.

나현이가 만든 벤치마크 스펙 10개(`resume_page`, `chatbot_ui`, `todo_app`,
`calculator`, `weather_widget`, `recipe_card`, `survey_form`, `pricing_table`,
`blog_list`, `login_form`)가 `benchmarks/`에 들어있음. 전부 실제 Claude 생성
HTML로 한 번씩 돌려서 체크리스트가 합리적으로 통과/실패하는지 확인함.
