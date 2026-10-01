"""
report.py — run_pilot.py 결과(summary.json)로 원본 vs 첨삭본 스크린샷 비교 리포트(report.html) 생성.

run_pilot.py가 끝날 때 자동으로 만들어지고, API 호출 없이 리포트만 다시 만들고 싶으면:
  python report.py    # results/summary.json → results/report.html
"""
import html
import json
from pathlib import Path

RESULTS_DIR = Path(__file__).resolve().parent / "results"
COND_LABEL = {"A_original": "A · 원본", "B_minifi": "B · Minifi 첨삭"}


def _e(s) -> str:
    return html.escape(str(s))


def _pct(x: float) -> str:
    return f"{x * 100:.0f}%"


def _summary_block(spec: dict) -> str:
    agg = spec["aggregate"]
    n = agg["A_original"]["runs"]
    bars = ""
    for cond in ("A_original", "B_minifi"):
        a = agg[cond]
        bars += f"""
      <div class="stat {cond}">
        <div class="stat-label">{COND_LABEL[cond]}</div>
        <div class="stat-num">{_pct(a['mean_pass_rate'])}</div>
        <div class="bar"><span style="width:{a['mean_pass_rate']*100:.1f}%"></span></div>
        <div class="stat-sub">최소 {_pct(a['min_pass_rate'])} · 최대 {_pct(a['max_pass_rate'])} · 전항목 통과 {a['all_pass_runs']}/{n}회<br>
        평균 출력 토큰 {a['mean_output_tokens']:.0f} · 콘솔 에러 {a['console_errors_total']}건</div>
      </div>"""

    rows = ""
    for item in spec["checklist"]:
        a_cnt = agg["A_original"]["item_pass_counts"][item["id"]]
        b_cnt = agg["B_minifi"]["item_pass_counts"][item["id"]]
        diff = "diff" if a_cnt != b_cnt else ""
        rows += (
            f'<tr class="{diff}"><td class="cid">{_e(item["id"])}</td><td>{_e(item["description"])}</td>'
            f'<td class="cnt">{a_cnt}/{n}</td><td class="cnt">{b_cnt}/{n}</td></tr>'
        )
    return f"""
    <div class="stats">{bars}</div>
    <div class="tablewrap"><table>
      <thead><tr><th>ID</th><th>체크 항목</th><th>A 통과</th><th>B 통과</th></tr></thead>
      <tbody>{rows}</tbody>
    </table></div>"""


def _shot(src: str, cls: str) -> str:
    return f'<a href="{_e(src)}" target="_blank" class="shot {cls}"><img src="{_e(src)}" loading="lazy" alt=""></a>'


def _run_block(run: dict) -> str:
    cols = ""
    for cond in ("A_original", "B_minifi"):
        c = run["conditions"][cond]
        g = c["grading"]
        failed = [i["id"] for i in g["items"] if not i["passed"]]
        fail_txt = f'<div class="fails">실패: {_e(", ".join(failed))}</div>' if failed else '<div class="fails ok">전항목 통과</div>'
        cols += f"""
        <div class="col">
          <div class="col-head"><strong>{COND_LABEL[cond]}</strong>
            <span class="score">{g['passed']}/{g['total']}</span>
            <a href="{_e(c['html_path'])}" target="_blank" class="open">HTML 열기</a></div>
          {fail_txt}
          <div class="shots">{_shot(g['screenshots']['desktop'], 'desktop')}{_shot(g['screenshots']['mobile'], 'mobile')}</div>
          <details><summary>사용한 프롬프트</summary><pre>{_e(c['prompt'])}</pre></details>
        </div>"""
    return f'<div class="run"><div class="run-label">run {run["run"]}</div><div class="cols">{cols}</div></div>'


def build_report(results: list[dict], out_path: Path) -> Path:
    toc = "".join(f'<a href="#{_e(s["id"])}">{_e(s["name"])}</a>' for s in results)
    sections = ""
    for spec in results:
        runs = "".join(_run_block(r) for r in spec["runs"])
        sections += f"""
  <section class="card" id="{_e(spec['id'])}">
    <h2>{_e(spec['name'])} <span class="sid">{_e(spec['id'])}</span></h2>
    <blockquote>{_e(spec['original_prompt'])}</blockquote>
    {_summary_block(spec)}
    <h3>실행별 스크린샷 (데스크톱 · 모바일, 상호작용 전 첫 화면)</h3>
    {runs}
  </section>"""

    page = f"""<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>원본 vs 첨삭 비교</title>
<style>
:root {{ --bg:#F7F8FA; --card:#fff; --ink:#0F1218; --sub:#5C6773; --line:#E4E8EE; --a:#64748B; --b:#0891B2; --b-bg:#E0F7F7; --diff:#FEF3C7; --bad:#B91C1C; --good:#15803D; }}
@media (prefers-color-scheme: dark) {{ :root:not([data-theme="light"]) {{ --bg:#0F1218; --card:#171B22; --ink:#E6EAF0; --sub:#9AA4B0; --line:#2A303A; --a:#94A3B8; --b:#22D3EE; --b-bg:#0E2F36; --diff:#3A2A0A; --bad:#F87171; --good:#4ADE80; }} }}
* {{ box-sizing:border-box; }}
body {{ margin:0; background:var(--bg); color:var(--ink); font:15px/1.6 -apple-system, "Apple SD Gothic Neo", system-ui, sans-serif; }}
main {{ max-width:1100px; margin:0 auto; padding:32px 16px 64px; }}
h1 {{ font-size:26px; margin:0 0 16px; }}
.toc {{ display:flex; flex-wrap:wrap; gap:6px; margin-bottom:24px; }}
.toc a {{ font-size:13px; text-decoration:none; color:var(--ink); background:var(--card); border:1px solid var(--line); border-radius:999px; padding:4px 12px; }}
.card {{ background:var(--card); border:1px solid var(--line); border-radius:14px; padding:20px; margin-bottom:20px; }}
h2 {{ font-size:20px; margin:0 0 10px; }}
h3 {{ font-size:14px; color:var(--sub); margin:20px 0 8px; }}
.sid {{ font:12px ui-monospace, monospace; color:var(--sub); }}
blockquote {{ margin:0 0 16px; padding:8px 12px; border-left:3px solid var(--line); color:var(--sub); }}
.stats {{ display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:12px; }}
.stat {{ border:1px solid var(--line); border-radius:10px; padding:12px; }}
.stat-label {{ font-size:13px; font-weight:700; }}
.stat-num {{ font-size:30px; font-weight:800; }}
.A_original .stat-num {{ color:var(--a); }} .B_minifi .stat-num {{ color:var(--b); }}
.bar {{ height:6px; background:var(--line); border-radius:3px; overflow:hidden; margin:4px 0 8px; }}
.bar span {{ display:block; height:100%; }}
.A_original .bar span {{ background:var(--a); }} .B_minifi .bar span {{ background:var(--b); }}
.stat-sub {{ font-size:12px; color:var(--sub); }}
.tablewrap {{ overflow-x:auto; }}
table {{ width:100%; border-collapse:collapse; font-size:13.5px; }}
th, td {{ text-align:left; padding:6px 8px; border-top:1px solid var(--line); vertical-align:top; }}
th {{ font-size:12px; color:var(--sub); border-top:none; }}
td.cid {{ font:12px ui-monospace, monospace; color:var(--sub); white-space:nowrap; }}
td.cnt {{ white-space:nowrap; font-variant-numeric:tabular-nums; }}
tr.diff td {{ background:var(--diff); }}
.run {{ border-top:1px solid var(--line); padding-top:12px; margin-top:12px; }}
.run-label {{ font:12px ui-monospace, monospace; color:var(--sub); margin-bottom:6px; }}
.cols {{ display:grid; grid-template-columns:1fr 1fr; gap:14px; }}
.col-head {{ display:flex; align-items:center; gap:8px; flex-wrap:wrap; }}
.score {{ font-weight:800; }}
.open {{ font-size:12px; margin-left:auto; color:var(--b); }}
.fails {{ font-size:12px; color:var(--bad); margin:2px 0 6px; }}
.fails.ok {{ color:var(--good); }}
.shots {{ display:grid; grid-template-columns:3fr 1fr; gap:8px; align-items:start; }}
.shot {{ display:block; max-height:420px; overflow:hidden; border:1px solid var(--line); border-radius:8px; background:#fff; }}
.shot img {{ display:block; width:100%; }}
details {{ margin-top:6px; font-size:12px; }}
details pre {{ white-space:pre-wrap; word-break:break-word; background:var(--bg); padding:8px; border-radius:6px; max-height:240px; overflow:auto; }}
@media (max-width:720px) {{ .stats, .cols {{ grid-template-columns:1fr; }} }}
</style></head>
<body><main>
<h1>원본 vs Minifi 첨삭 — 결과 비교</h1>
<nav class="toc">{toc}</nav>
{sections}
</main></body></html>"""
    out_path.write_text(page, encoding="utf-8")
    return out_path


if __name__ == "__main__":
    summary = json.loads((RESULTS_DIR / "summary.json").read_text(encoding="utf-8"))
    print(build_report(summary, RESULTS_DIR / "report.html"))
