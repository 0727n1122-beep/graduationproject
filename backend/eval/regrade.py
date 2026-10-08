"""
regrade.py — 이미 생성된 결과 HTML(results/*.html)을 지금 benchmarks/*.json + checks.py
기준으로 다시 채점만 함. run_pilot.py처럼 Claude API를 다시 호출하지 않음.

체크리스트(checks.py)나 벤치마크 스펙만 고쳤을 때, 토큰/시간 안 들이고
바로 결과가 어떻게 바뀌는지 확인하는 용도.

실행:
  python regrade.py                # results/ 안의 모든 결과 재채점
  python regrade.py resume_page    # 특정 벤치마크 id만
"""
import json
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

from checks import run_check, run_setup_action

RESULTS_DIR = Path(__file__).resolve().parent / "results"
BENCH_DIR = Path(__file__).resolve().parent / "benchmarks"


def grade_html(page, html_path: Path, checklist: list[dict], setup_actions: list[dict] = None) -> dict:
    console_errors = []
    item_results = []
    page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
    page.on("pageerror", lambda exc: console_errors.append(str(exc)))
    page.goto(f"file://{html_path.resolve()}")
    page.wait_for_timeout(500)
    for action in setup_actions or []:
        try:
            run_setup_action(page, action)
            page.wait_for_timeout(200)
        except Exception as e:
            console_errors.append(f"setup_action 실패 {action}: {e}")
    for item in checklist:
        try:
            result = run_check(page, item)
        except Exception as e:
            result = {"passed": False, "detail": f"check error: {e}"}
        item_results.append({"id": item["id"], "description": item["description"], **result})
    passed = sum(1 for r in item_results if r["passed"])
    return {"items": item_results, "passed": passed, "total": len(item_results), "console_errors": console_errors}


def main():
    wanted = set(sys.argv[1:]) or None
    specs = {}
    for p in BENCH_DIR.glob("*.json"):
        spec = json.loads(p.read_text(encoding="utf-8"))
        if wanted is None or spec["id"] in wanted:
            specs[spec["id"]] = spec

    if not specs:
        print("해당하는 벤치마크 스펙이 없음", file=sys.stderr)
        sys.exit(1)

    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        for spec_id, spec in specs.items():
            html_files = sorted(RESULTS_DIR.glob(f"{spec_id}_*.html"))
            if not html_files:
                print(f"{spec['name']}: results/ 안에 생성된 HTML이 없음 (run_pilot.py를 먼저 실행)")
                continue
            print(f"\n=== {spec['name']} ({spec_id}) — 재채점 ===")
            for html_path in html_files:
                cond = html_path.stem[len(spec_id) + 1:]
                page = browser.new_page()
                grading = grade_html(page, html_path, spec["checklist"], spec.get("setup_actions"))
                page.close()
                fails = [it["id"] for it in grading["items"] if not it["passed"]]
                print(
                    f"  {cond:12s} {grading['passed']}/{grading['total']} 통과  "
                    f"콘솔에러 {len(grading['console_errors'])}건"
                    + (f"  실패항목={fails}" if fails else "")
                )
        browser.close()


if __name__ == "__main__":
    main()
