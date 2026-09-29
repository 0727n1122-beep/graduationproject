"""
checks.py — 벤치마크 체크리스트 항목을 실제 Playwright 검사로 변환.

체크 타입:
  - element_exists       : selector에 해당하는 요소가 1개 이상 있으면 통과
  - element_count_min     : selector 요소 개수가 min 이상이면 통과
  - text_contains_any     : body 텍스트에 texts 중 하나라도 포함되면 통과
  - text_regex            : body 텍스트가 pattern(정규식)에 매치되면 통과
  - any_of                : checks 목록 중 하나라도 통과하면 통과 (조건 완화용)

각 run_check 호출은 {"passed": bool, "detail": str}를 돌려줌.
"""
import re


def run_check(page, check: dict) -> dict:
    ctype = check["type"]

    if ctype == "element_exists":
        count = page.locator(check["selector"]).count()
        return {"passed": count >= 1, "detail": f"count={count}"}

    if ctype == "element_count_min":
        count = page.locator(check["selector"]).count()
        return {"passed": count >= check["min"], "detail": f"count={count}, min={check['min']}"}

    if ctype == "text_contains_any":
        body_text = page.inner_text("body")
        matched = [t for t in check["texts"] if t.lower() in body_text.lower()]
        return {"passed": len(matched) > 0, "detail": f"matched={matched}"}

    if ctype == "text_regex":
        body_text = page.inner_text("body")
        m = re.search(check["pattern"], body_text)
        return {"passed": m is not None, "detail": f"match={m.group(0) if m else None}"}

    if ctype == "any_of":
        results = [run_check(page, sub) for sub in check["checks"]]
        return {
            "passed": any(r["passed"] for r in results),
            "detail": "; ".join(r["detail"] for r in results),
        }

    raise ValueError(f"알 수 없는 check type: {ctype}")
