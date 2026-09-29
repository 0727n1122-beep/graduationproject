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
  "checklist": [
    { "id": "c1", "description": "...", "type": "element_count_min", "selector": "li", "min": 1 }
  ]
}
```

체크 타입은 `checks.py` 참고 (`element_exists` / `element_count_min` /
`text_contains_any` / `text_regex` / `any_of`).

나현이가 만든 벤치마크 스펙(이력서 페이지 등)이 나오면 이 형식으로 옮겨서
`benchmarks/`에 추가하면 됨 — `resume_page.json`은 실제 스펙 나오기 전까지
파이프라인 자체를 테스트해보기 위한 임시 스펙임.
