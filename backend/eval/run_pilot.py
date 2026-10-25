"""
run_pilot.py — 평가 파이프라인 파일럿 (원본 vs Minifi 첨삭본)

흐름:
  1. 벤치마크 스펙(benchmarks/*.json)의 원본 프롬프트를 그대로 씀 (조건 A)
  2. 그 프롬프트를 로컬(또는 배포된) 백엔드 /optimize에 보내서 optimized_prompt를 받음 (조건 B)
  3. 각 조건의 프롬프트로 Claude에게 "한 파일짜리 HTML 결과물"을 원샷 생성시킴
  4. 결과 HTML을 저장하고, Playwright로 벤치마크의 기능 체크리스트를 자동 채점
  5. 조건별 기능 충족률 / 콘솔 에러 수 / 토큰 사용량을 비교해서 summary.json + 표로 출력

실행 전 준비 (팀 각자 로컬에서):
  cd backend
  source venv/bin/activate  # 또는 팀에서 쓰는 가상환경
  pip install -r requirements.txt
  pip install playwright
  playwright install chromium
  # backend/.env에 ANTHROPIC_BASE_URL / ANTHROPIC_API_KEY가 이미 있어야 함
  # 로컬 uvicorn(main:app)이 켜져 있어야 함 (기본 API_URL=http://localhost:8000)

실행:
  cd backend/eval
  python run_pilot.py                          # benchmarks/ 안의 스펙 전부
  python run_pilot.py benchmarks/resume_page.json   # 특정 스펙 하나만
"""
import glob
import json
import os
import re
import sys
from pathlib import Path

from dotenv import load_dotenv
import requests
import anthropic
from playwright.sync_api import sync_playwright

from checks import run_check, run_setup_action

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

API_URL = os.getenv("EVAL_API_URL", "http://localhost:8000")
ANTHROPIC_BASE_URL = os.getenv("ANTHROPIC_BASE_URL")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
GEN_MODEL = os.getenv("EVAL_GEN_MODEL", "claude-haiku-4-5-20251001")  # main.py/error_coach.py와 동일한 확인된 모델 id

RESULTS_DIR = Path(__file__).resolve().parent / "results"
RESULTS_DIR.mkdir(exist_ok=True)

GEN_SYSTEM_PROMPT = (
    "너는 요청받은 웹 페이지/앱을 단일 HTML 파일 하나로 만드는 프론트엔드 개발자야. "
    "CSS와 JS를 전부 그 HTML 파일 안에 인라인으로 넣어서, 외부 파일이나 서버 없이 "
    "브라우저에서 파일을 열기만 해도 완전히 동작해야 해. "
    "다른 설명 없이 <!DOCTYPE html>로 시작하는 HTML 코드만 출력해."
)


def build_anthropic_client() -> anthropic.Anthropic:
    kwargs = {"api_key": ANTHROPIC_API_KEY}
    if ANTHROPIC_BASE_URL:
        kwargs["base_url"] = ANTHROPIC_BASE_URL
    return anthropic.Anthropic(**kwargs)


def extract_html(text: str) -> str:
    """모델 응답에서 ```html ... ``` 코드펜스가 있으면 안쪽만, 없으면 그대로 반환."""
    m = re.search(r"```(?:html)?\s*\n(.*?)```", text, re.DOTALL)
    return m.group(1).strip() if m else text.strip()


def call_optimize(prompt: str) -> str:
    resp = requests.post(f"{API_URL}/optimize", json={"prompt": prompt}, timeout=60)
    resp.raise_for_status()
    data = resp.json()
    if "optimized_prompt" not in data:
        raise RuntimeError(f"/optimize 응답에 optimized_prompt가 없음: {data}")
    return data["optimized_prompt"]


def generate_html(client: anthropic.Anthropic, prompt: str) -> tuple[str, dict]:
    resp = client.messages.create(
        model=GEN_MODEL,
        max_tokens=8000,
        system=GEN_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}],
    )
    html = extract_html(resp.content[0].text)
    usage = {"input_tokens": resp.usage.input_tokens, "output_tokens": resp.usage.output_tokens}
    return html, usage


def grade_html(html_path: Path, checklist: list[dict], setup_actions: list[dict] = None) -> dict:
    console_errors = []
    item_results = []
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        page = browser.new_page()
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
        page.on("pageerror", lambda exc: console_errors.append(str(exc)))
        page.goto(f"file://{html_path.resolve()}")
        page.wait_for_timeout(500)  # JS onload/렌더링 여유
        for action in setup_actions or []:
            # 할 일 추가 후 체크박스가 생기는 등, 상호작용 후에만 나타나는 기능을
            # 채점 전에 미리 실행해둠. 실패해도(셀렉터가 다를 수 있음) 채점 자체는 계속.
            try:
                run_setup_action(page, action)
                page.wait_for_timeout(200)
            except Exception as e:
                console_errors.append(f"setup_action 실패 {action}: {e}")
        for item in checklist:
            try:
                result = run_check(page, item)
            except Exception as e:  # 체크 자체가 깨져도 파일럿 전체가 죽지 않게
                result = {"passed": False, "detail": f"check error: {e}"}
            item_results.append({"id": item["id"], "description": item["description"], **result})
        browser.close()
    passed = sum(1 for r in item_results if r["passed"])
    return {
        "items": item_results,
        "passed": passed,
        "total": len(item_results),
        "console_errors": console_errors,
    }


def run_spec(spec_path: Path, client: anthropic.Anthropic) -> dict:
    spec = json.loads(spec_path.read_text(encoding="utf-8"))
    spec_id = spec["id"]
    print(f"\n=== {spec['name']} ({spec_id}) ===")

    conditions = {"A_original": spec["original_prompt"]}
    print("  [B] /optimize 호출 중...")
    conditions["B_minifi"] = call_optimize(spec["original_prompt"])

    spec_result = {"id": spec_id, "name": spec["name"], "conditions": {}}
    for cond_name, cond_prompt in conditions.items():
        print(f"  [{cond_name}] Claude로 HTML 생성 중...")
        html, usage = generate_html(client, cond_prompt)
        html_path = RESULTS_DIR / f"{spec_id}_{cond_name}.html"
        html_path.write_text(html, encoding="utf-8")

        print(f"  [{cond_name}] Playwright 채점 중...")
        grading = grade_html(html_path, spec["checklist"], spec.get("setup_actions"))

        spec_result["conditions"][cond_name] = {
            "prompt": cond_prompt,
            "html_path": str(html_path.relative_to(RESULTS_DIR.parent)),
            "usage": usage,
            "grading": grading,
        }
        print(
            f"  [{cond_name}] {grading['passed']}/{grading['total']} 통과, "
            f"콘솔 에러 {len(grading['console_errors'])}건, "
            f"토큰 {usage['input_tokens']}+{usage['output_tokens']}"
        )
    return spec_result


def main():
    if not ANTHROPIC_API_KEY:
        print("ANTHROPIC_API_KEY가 없음 — backend/.env 확인 필요", file=sys.stderr)
        sys.exit(1)

    spec_paths = (
        [Path(p) for p in sys.argv[1:]]
        if len(sys.argv) > 1
        else [Path(p) for p in glob.glob(str(Path(__file__).parent / "benchmarks" / "*.json"))]
    )
    if not spec_paths:
        print("benchmarks/*.json이 없음", file=sys.stderr)
        sys.exit(1)

    client = build_anthropic_client()
    all_results = [run_spec(p, client) for p in spec_paths]

    summary_path = RESULTS_DIR / "summary.json"
    summary_path.write_text(json.dumps(all_results, ensure_ascii=False, indent=2), encoding="utf-8")

    print("\n\n=== 요약 ===")
    for r in all_results:
        print(f"\n{r['name']}")
        for cond_name, cond in r["conditions"].items():
            g = cond["grading"]
            print(
                f"  {cond_name:12s} 기능충족률 {g['passed']}/{g['total']}  "
                f"콘솔에러 {len(g['console_errors'])}건  "
                f"토큰 {cond['usage']['input_tokens']}+{cond['usage']['output_tokens']}"
            )
    print(f"\n전체 결과: {summary_path}")


if __name__ == "__main__":
    main()
