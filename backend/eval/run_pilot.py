"""
run_pilot.py — 평가 파이프라인 파일럿 (원본 vs Minifi 첨삭본)

흐름:
  1. 벤치마크 스펙(benchmarks/*.json)의 원본 프롬프트를 그대로 씀 (조건 A)
  2. 그 프롬프트를 로컬(또는 배포된) 백엔드 /optimize에 보내서 optimized_prompt를 받음 (조건 B)
  3. 각 조건의 프롬프트로 Claude에게 "한 파일짜리 HTML 결과물"을 원샷 생성시킴
  4. 결과 HTML을 저장하고, 스크린샷(데스크톱/모바일)을 찍은 뒤 Playwright로 체크리스트 자동 채점
  5. 1~4를 --runs번 반복해서, 조건별 평균 기능 충족률 / 항목별 통과 횟수 / 토큰 사용량을
     summary.json + 표로 출력하고, 원본·첨삭본 스크린샷을 나란히 비교하는 report.html 생성

생성 결과는 매번 달라지므로(같은 프롬프트로도 통과/실패가 갈림) 한 번 실행한 결과로
"첨삭이 낫다/아니다"를 말할 수 없음 — 비교 결론을 낼 때는 --runs 5 이상 권장.
첨삭본(B)도 /optimize 결과가 매번 달라서, 반복마다 새로 첨삭받음.

실행 전 준비 (팀 각자 로컬에서):
  cd backend
  source venv/bin/activate  # 또는 팀에서 쓰는 가상환경
  pip install -r requirements.txt
  pip install -r eval/requirements.txt
  playwright install chromium
  # backend/.env에 ANTHROPIC_BASE_URL / ANTHROPIC_API_KEY가 이미 있어야 함
  # 로컬 uvicorn(main:app)이 켜져 있어야 함 (기본 API_URL=http://localhost:8000)

실행:
  cd backend/eval
  python run_pilot.py                                       # benchmarks/ 안의 스펙 전부, 1회
  python run_pilot.py --runs 5                              # 전부, 조건별 5회씩
  python run_pilot.py --runs 5 benchmarks/resume_page.json  # 특정 스펙만
"""
import argparse
import glob
import json
import os
import re
import statistics
import sys
import time
from pathlib import Path

from dotenv import load_dotenv
import requests
import anthropic
from playwright.sync_api import sync_playwright

from checks import grade_checklist, open_page
from report import build_report

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

API_URL = os.getenv("EVAL_API_URL", "http://localhost:8000")
ANTHROPIC_BASE_URL = os.getenv("ANTHROPIC_BASE_URL")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
GEN_MODEL = os.getenv("EVAL_GEN_MODEL", "claude-haiku-4-5-20251001")  # main.py/error_coach.py와 동일한 확인된 모델 id

RESULTS_DIR = Path(__file__).resolve().parent / "results"
RESULTS_DIR.mkdir(exist_ok=True)

CONDITIONS = ["A_original", "B_minifi"]
DESKTOP_VIEWPORT = {"width": 1280, "height": 720}  # Playwright 기본값 — 체크는 항상 이 크기에서
MOBILE_VIEWPORT = {"width": 375, "height": 812}

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


def call_optimize(prompt: str, attempts: int = 3) -> str:
    # /optimize는 모델 응답 JSON 파싱 실패 등으로 가끔 {"error": ...}를 돌려줌 — 실제 사용자도
    # "다시 시도"를 누르는 상황이라 몇 번 재시도하고, 그래도 안 되면 실행을 멈춤
    for i in range(attempts):
        resp = requests.post(f"{API_URL}/optimize", json={"prompt": prompt}, timeout=90)
        resp.raise_for_status()
        data = resp.json()
        if "optimized_prompt" in data:
            return data["optimized_prompt"]
        print(f"  /optimize 실패({i + 1}/{attempts}): {data.get('error')}")
        time.sleep(2)
    raise RuntimeError(f"/optimize가 {attempts}번 연속 실패: {data}")


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
    """체크리스트 채점 + 스크린샷. 스크린샷은 상호작용 전, 사용자가 처음 여는 화면 기준."""
    console_errors = []
    stem = html_path.stem
    url = f"file://{html_path.resolve()}"
    screenshots = {"desktop": f"{stem}_desktop.png", "mobile": f"{stem}_mobile.png"}
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        page = open_page(browser, url, DESKTOP_VIEWPORT, console_errors)

        page.screenshot(path=str(RESULTS_DIR / screenshots["desktop"]), full_page=True)
        page.set_viewport_size(MOBILE_VIEWPORT)
        page.wait_for_timeout(200)
        page.screenshot(path=str(RESULTS_DIR / screenshots["mobile"]), full_page=True)
        # 미디어 쿼리로 숨겨지는 요소가 inner_text에서 빠지지 않도록, 채점은 원래 크기로 되돌려서
        page.set_viewport_size(DESKTOP_VIEWPORT)
        page.wait_for_timeout(200)

        item_results = grade_checklist(
            browser, page, url, DESKTOP_VIEWPORT, checklist, setup_actions, console_errors
        )
        browser.close()
    passed = sum(1 for r in item_results if r["passed"])
    return {
        "items": item_results,
        "passed": passed,
        "total": len(item_results),
        "console_errors": console_errors,
        "screenshots": screenshots,
    }


def aggregate(runs: list[dict], checklist: list[dict]) -> dict:
    """반복 실행 결과를 조건별로 요약: 평균/최소/최대 통과율, 항목별 통과 횟수, 평균 토큰."""
    agg = {}
    for cond in CONDITIONS:
        conds = [run["conditions"][cond] for run in runs]
        rates = [c["grading"]["passed"] / c["grading"]["total"] for c in conds]
        item_pass_counts = {
            item["id"]: sum(
                1 for c in conds
                for r in c["grading"]["items"]
                if r["id"] == item["id"] and r["passed"]
            )
            for item in checklist
        }
        agg[cond] = {
            "runs": len(conds),
            "mean_pass_rate": statistics.mean(rates),
            "stdev_pass_rate": statistics.pstdev(rates),
            "min_pass_rate": min(rates),
            "max_pass_rate": max(rates),
            "all_pass_runs": sum(1 for c in conds if c["grading"]["passed"] == c["grading"]["total"]),
            "item_pass_counts": item_pass_counts,
            "mean_output_tokens": statistics.mean(c["usage"]["output_tokens"] for c in conds),
            "console_errors_total": sum(len(c["grading"]["console_errors"]) for c in conds),
        }
    return agg


def run_spec(spec_path: Path, client: anthropic.Anthropic, n_runs: int) -> dict:
    spec = json.loads(spec_path.read_text(encoding="utf-8"))
    spec_id = spec["id"]
    print(f"\n=== {spec['name']} ({spec_id}) — {n_runs}회 ===")

    runs = []
    for r in range(1, n_runs + 1):
        print(f"  [run {r}/{n_runs}] /optimize 호출 중...")
        prompts = {"A_original": spec["original_prompt"], "B_minifi": call_optimize(spec["original_prompt"])}
        run_result = {"run": r, "conditions": {}}
        for cond_name in CONDITIONS:
            html, usage = generate_html(client, prompts[cond_name])
            html_path = RESULTS_DIR / f"{spec_id}_{cond_name}_r{r}.html"
            html_path.write_text(html, encoding="utf-8")
            grading = grade_html(html_path, spec["checklist"], spec.get("setup_actions"))
            run_result["conditions"][cond_name] = {
                "prompt": prompts[cond_name],
                "html_path": html_path.name,
                "usage": usage,
                "grading": grading,
            }
            print(
                f"  [run {r}/{n_runs}] {cond_name:10s} {grading['passed']}/{grading['total']} 통과, "
                f"콘솔 에러 {len(grading['console_errors'])}건, 출력 토큰 {usage['output_tokens']}"
            )
        runs.append(run_result)

    return {
        "id": spec_id,
        "name": spec["name"],
        "original_prompt": spec["original_prompt"],
        "checklist": [{"id": c["id"], "description": c["description"]} for c in spec["checklist"]],
        "runs": runs,
        "aggregate": aggregate(runs, spec["checklist"]),
    }


def main():
    parser = argparse.ArgumentParser(description="원본 vs Minifi 첨삭본 평가 파일럿")
    parser.add_argument("specs", nargs="*", help="벤치마크 스펙 경로 (생략하면 benchmarks/ 전부)")
    parser.add_argument("--runs", type=int, default=1, help="조건별 반복 생성 횟수 (비교 결론엔 5 이상 권장)")
    args = parser.parse_args()

    if not ANTHROPIC_API_KEY:
        print("ANTHROPIC_API_KEY가 없음 — backend/.env 확인 필요", file=sys.stderr)
        sys.exit(1)
    if args.runs < 1:
        print("--runs는 1 이상이어야 함", file=sys.stderr)
        sys.exit(1)

    spec_paths = (
        [Path(p) for p in args.specs]
        if args.specs
        else sorted(Path(p) for p in glob.glob(str(Path(__file__).parent / "benchmarks" / "*.json")))
    )
    if not spec_paths:
        print("benchmarks/*.json이 없음", file=sys.stderr)
        sys.exit(1)

    client = build_anthropic_client()
    all_results = [run_spec(p, client, args.runs) for p in spec_paths]

    summary_path = RESULTS_DIR / "summary.json"
    summary_path.write_text(json.dumps(all_results, ensure_ascii=False, indent=2), encoding="utf-8")
    report_path = build_report(all_results, RESULTS_DIR / "report.html")

    print(f"\n\n=== 요약 (조건별 {args.runs}회) ===")
    for r in all_results:
        print(f"\n{r['name']}")
        for cond_name, a in r["aggregate"].items():
            print(
                f"  {cond_name:10s} 평균 충족률 {a['mean_pass_rate']*100:5.1f}% "
                f"(최소 {a['min_pass_rate']*100:.0f}% / 최대 {a['max_pass_rate']*100:.0f}%)  "
                f"전항목 통과 {a['all_pass_runs']}/{a['runs']}회  "
                f"평균 출력 토큰 {a['mean_output_tokens']:.0f}  콘솔에러 {a['console_errors_total']}건"
            )
    print(f"\n전체 결과: {summary_path}")
    print(f"스크린샷 비교 리포트: {report_path}")


if __name__ == "__main__":
    main()
