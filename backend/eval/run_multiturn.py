"""
run_multiturn.py — 멀티턴 평가 (원본 vs Minifi 첨삭본)

단일 턴(run_pilot.py)은 "한 번에 얼마나 잘 만드나"만 봄. 실제로는 결과물을 써보고
안 되는 걸 다시 요청하는 대화가 이어지므로, 여기서는 "몇 번 다시 요청해야 완성되나"
(재질문 횟수)와 그동안 쌓인 토큰을 비교함.

흐름 (스펙 × 조건 × 반복마다):
  1. 첫 요청
     - A: 원본 프롬프트 그대로
     - B: /optimize 첨삭본. [입력 필요] 같은 빈칸이 있으면, 원래 요청만 아는 가상
       사용자(LLM)가 원래 의도 범위 안에서 채움 — 실제 서비스에서 사용자가 하는 일
  2. 생성 → 체크리스트 채점
  3. 실패 항목이 있으면, 그 항목들의 고정 불평 문장(스펙의 "complaint")을 묶어 다음
     사용자 메시지로 보내고 모델이 고친 HTML을 다시 냄. 불평 문장은 A/B가 똑같음.
  4. 전 항목 통과 또는 --max-turns까지 반복

측정:
  - 재질문 횟수: 전 항목 통과까지 보낸 후속 요청 수 (첫 턴에 통과하면 0)
  - 완성률: --max-turns 안에 전 항목 통과한 비율
  - 대화 토큰: 모든 턴의 입력+출력 토큰 합 (이전 대화가 계속 쌓이므로 턴이 늘수록 커짐)
  빈칸 채우기 호출은 사용자 쪽 시뮬레이션이라 대화 토큰에서 따로 기록함.

실행:
  cd backend/eval
  python run_multiturn.py --runs 5                     # 전부
  python run_multiturn.py --runs 5 --max-turns 5 benchmarks/todo_app.json
결과: results/multiturn/<스펙>_<조건>_r<회차>_t<턴>.html + results/multiturn/summary.json
"""
import argparse
import glob
import json
import re
import statistics
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

from checks import grade_checklist, open_page
from run_pilot import (
    ANTHROPIC_API_KEY,
    CONDITIONS,
    DESKTOP_VIEWPORT,
    GEN_MODEL,
    GEN_SYSTEM_PROMPT,
    RESULTS_DIR,
    build_anthropic_client,
    call_optimize,
    extract_html,
)

OUT_DIR = RESULTS_DIR / "multiturn"
OUT_DIR.mkdir(exist_ok=True)

PLACEHOLDER_RE = re.compile(r"\[[^\]\n]*(?:입력|필요|여기)[^\]\n]*\]")

FILL_SYSTEM = (
    "너는 아래 <원래_요청>을 직접 쓴 비개발자 사용자야. 프롬프트 첨삭 서비스가 네 요청을 "
    "다듬어 주면서, 네가 직접 채워야 할 부분을 [입력 필요: ...] 같은 대괄호 빈칸으로 남겨뒀어.\n"
    "- 대괄호 빈칸만, 원래 요청에서 네가 의도했던 범위 안에서 비개발자가 실제로 적을 법한 짧고 "
    "구체적인 내용으로 채워. 대괄호와 '입력 필요' 표시는 지우고 채운 내용만 남겨.\n"
    "- 원래 요청에 개수나 양(예: '몇 가지', '여러 개')이 있었다면 채울 때도 그만큼 채워.\n"
    "- 원래 요청에 없던 기능이나 조건을 새로 추가하지 마.\n"
    "- 빈칸이 아닌 문장은 한 글자도 바꾸지 마. (예: ...) 같은 괄호 예시도 그대로 둬.\n"
    "- 설명 없이, 빈칸을 채운 요청 전문만 출력해."
)

FOLLOWUP_HEAD = "만들어준 거 써봤는데 이런 게 안 돼요.\n"
FOLLOWUP_TAIL = "\n고쳐주세요."


def fill_placeholders(client, original: str, optimized: str):
    if not PLACEHOLDER_RE.search(optimized):
        return optimized, None
    resp = client.messages.create(
        model=GEN_MODEL,
        max_tokens=2000,
        system=FILL_SYSTEM,
        messages=[{"role": "user", "content": f"<원래_요청>\n{original}\n</원래_요청>\n\n<첨삭된_요청>\n{optimized}\n</첨삭된_요청>"}],
    )
    usage = {"input_tokens": resp.usage.input_tokens, "output_tokens": resp.usage.output_tokens}
    return resp.content[0].text.strip(), usage


def grade(browser, html_path: Path, spec: dict) -> list[dict]:
    console_errors = []
    url = f"file://{html_path.resolve()}"
    page = open_page(browser, url, DESKTOP_VIEWPORT, console_errors)
    items = grade_checklist(browser, page, url, DESKTOP_VIEWPORT, spec["checklist"], spec.get("setup_actions"), console_errors)
    page.close()
    return items


def run_conversation(client, browser, spec: dict, first_prompt: str, stem: str, max_turns: int) -> dict:
    complaints = {c["id"]: c["complaint"] for c in spec["checklist"]}
    messages = [{"role": "user", "content": first_prompt}]
    turns = []
    for t in range(1, max_turns + 1):
        resp = client.messages.create(model=GEN_MODEL, max_tokens=8000, system=GEN_SYSTEM_PROMPT, messages=messages)
        text = resp.content[0].text
        html_path = OUT_DIR / f"{stem}_t{t}.html"
        html_path.write_text(extract_html(text), encoding="utf-8")
        items = grade(browser, html_path, spec)
        failed = [i["id"] for i in items if not i["passed"]]
        turns.append({
            "turn": t,
            "user_message": messages[-1]["content"],
            "html_path": html_path.name,
            "usage": {"input_tokens": resp.usage.input_tokens, "output_tokens": resp.usage.output_tokens},
            "passed": len(items) - len(failed),
            "total": len(items),
            "failed": failed,
            "items": items,
        })
        if not failed:
            break
        messages.append({"role": "assistant", "content": text})
        messages.append({"role": "user", "content": FOLLOWUP_HEAD + "\n".join(f"- {complaints[f]}" for f in failed) + FOLLOWUP_TAIL})
    solved = not turns[-1]["failed"]
    return {
        "solved": solved,
        "followups": len(turns) - 1,
        "turns": turns,
        "conversation_tokens": sum(x["usage"]["input_tokens"] + x["usage"]["output_tokens"] for x in turns),
        "first_turn_pass_rate": turns[0]["passed"] / turns[0]["total"],
    }


def aggregate(runs: list[dict], max_turns: int) -> dict:
    agg = {}
    for cond in CONDITIONS:
        convs = [r["conditions"][cond] for r in runs]
        agg[cond] = {
            "runs": len(convs),
            "solved": sum(c["solved"] for c in convs),
            # 끝내 못 끝낸 대화는 "최대 턴까지 다 쓴 것"으로 계산 → 실제 재질문 수의 하한
            "mean_followups": statistics.mean(c["followups"] for c in convs),
            "mean_conversation_tokens": statistics.mean(c["conversation_tokens"] for c in convs),
            "mean_first_turn_pass_rate": statistics.mean(c["first_turn_pass_rate"] for c in convs),
            "zero_followup_runs": sum(c["followups"] == 0 and c["solved"] for c in convs),
            "max_turns": max_turns,
        }
    return agg


def main():
    parser = argparse.ArgumentParser(description="원본 vs Minifi 첨삭본 멀티턴 평가")
    parser.add_argument("specs", nargs="*", help="벤치마크 스펙 경로 (생략하면 benchmarks/ 전부)")
    parser.add_argument("--runs", type=int, default=1)
    parser.add_argument("--max-turns", type=int, default=5, help="첫 요청 포함 최대 생성 횟수")
    args = parser.parse_args()
    if not ANTHROPIC_API_KEY:
        print("ANTHROPIC_API_KEY가 없음 — backend/.env 확인 필요", file=sys.stderr)
        sys.exit(1)

    spec_paths = (
        [Path(p) for p in args.specs] if args.specs
        else sorted(Path(p) for p in glob.glob(str(Path(__file__).parent / "benchmarks" / "*.json")))
    )
    client = build_anthropic_client()
    results = []
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        for spec_path in spec_paths:
            spec = json.loads(spec_path.read_text(encoding="utf-8"))
            print(f"\n=== {spec['name']} ({spec['id']}) — {args.runs}회, 최대 {args.max_turns}턴 ===")
            runs = []
            for r in range(1, args.runs + 1):
                optimized = call_optimize(spec["original_prompt"])
                filled, fill_usage = fill_placeholders(client, spec["original_prompt"], optimized)
                firsts = {"A_original": spec["original_prompt"], "B_minifi": filled}
                run = {"run": r, "optimized_prompt": optimized, "filled_prompt": filled if fill_usage else None,
                       "fill_usage": fill_usage, "conditions": {}}
                for cond in CONDITIONS:
                    conv = run_conversation(client, browser, spec, firsts[cond], f"{spec['id']}_{cond}_r{r}", args.max_turns)
                    run["conditions"][cond] = conv
                    path = " → ".join(f"{t['passed']}/{t['total']}" for t in conv["turns"])
                    print(f"  [run {r}] {cond:10s} 재질문 {conv['followups']}회 {'완성' if conv['solved'] else '미완성'}  "
                          f"({path})  대화 토큰 {conv['conversation_tokens']}")
                runs.append(run)
            results.append({"id": spec["id"], "name": spec["name"], "runs": runs, "aggregate": aggregate(runs, args.max_turns)})
            (OUT_DIR / "summary.json").write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
        browser.close()

    print(f"\n\n=== 요약 (조건별 {args.runs}회, 최대 {args.max_turns}턴) ===")
    for res in results:
        print(f"\n{res['name']}")
        for cond, a in res["aggregate"].items():
            print(f"  {cond:10s} 평균 재질문 {a['mean_followups']:.1f}회  완성 {a['solved']}/{a['runs']}  "
                  f"첫 턴 충족률 {a['mean_first_turn_pass_rate']*100:.0f}%  평균 대화 토큰 {a['mean_conversation_tokens']:.0f}")
    print(f"\n전체 결과: {OUT_DIR / 'summary.json'}")


if __name__ == "__main__":
    main()
