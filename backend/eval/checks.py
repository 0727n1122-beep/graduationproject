"""
checks.py — 벤치마크 체크리스트 항목을 실제 Playwright 검사로 변환.

체크 타입:
  - element_exists        : selector에 해당하는 요소가 1개 이상 있으면 통과
  - element_count_min      : selector 요소 개수가 min 이상이면 통과
  - text_contains_any      : body 텍스트에 texts 중 하나라도 포함되면 통과
  - text_regex             : body 텍스트가 pattern(정규식)에 매치되면 통과
  - text_regex_count_min   : body 텍스트에서 pattern에 매치되는 횟수가 min 이상이면 통과
  - computed_style_any     : selector 요소 중 실제 적용된 스타일(getComputedStyle)의 property에
                             value가 들어간 요소가 하나라도 있으면 통과
  - any_of                 : checks 목록 중 하나라도 통과하면 통과 (조건 완화용)

각 run_check 호출은 {"passed": bool, "detail": str}를 돌려줌.

setup_actions: 체크리스트를 보기 전에 페이지와 상호작용해야만 나타나는 기능
(할 일 추가 후 체크박스/삭제 버튼이 생기는 todo 앱 등)을 위해, 벤치마크 스펙에
최상위 "setup_actions" 배열을 추가하면 채점 전에 run_setup_action으로 순서대로
실행해줌. action type: fill(입력) / click(클릭) / press(키 입력).
"""
import re


def run_setup_action(page, action: dict):
    atype = action["type"]
    locator = page.locator(action["selector"]).first
    if atype == "fill":
        locator.fill(action["value"])
    elif atype == "click":
        locator.click()
    elif atype == "press":
        locator.press(action["key"])
    else:
        raise ValueError(f"알 수 없는 setup_action type: {atype}")


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

    if ctype == "text_regex_count_min":
        # li/div 등 특정 태그에 의존하지 않고, 반복되는 패턴(예: 연도, 항목 번호)이
        # 본문에 몇 번 나오는지로 "목록 항목이 N개 있다" 같은 걸 태그 구조와 무관하게 검사.
        body_text = page.inner_text("body")
        matches = re.findall(check["pattern"], body_text)
        count = len(matches)
        return {"passed": count >= check["min"], "detail": f"count={count}, min={check['min']}"}

    if ctype == "computed_style_any":
        # 클래스 토글이든 인라인 style이든 "input:checked ~ span" 같은 CSS 선택자든,
        # 구현 방식과 무관하게 브라우저가 실제로 적용한 스타일로 판정
        count = page.evaluate(
            """([sel, prop, val]) => [...document.querySelectorAll(sel)]
                .filter(el => getComputedStyle(el).getPropertyValue(prop).includes(val)).length""",
            [check["selector"], check["property"], check["value"]],
        )
        return {"passed": count >= 1, "detail": f"count={count}"}

    if ctype == "any_of":
        results = [run_check(page, sub) for sub in check["checks"]]
        return {
            "passed": any(r["passed"] for r in results),
            "detail": "; ".join(r["detail"] for r in results),
        }

    raise ValueError(f"알 수 없는 check type: {ctype}")
