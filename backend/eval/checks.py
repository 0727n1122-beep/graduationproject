"""
checks.py — 벤치마크 체크리스트 항목을 실제 Playwright 검사로 변환.

체크 타입:
  - element_exists        : selector에 해당하는 요소가 1개 이상 있으면 통과
  - element_count_min      : selector 요소 개수가 min 이상이면 통과
  - text_contains_any      : body 텍스트에 texts 중 하나라도 포함되면 통과
  - text_regex             : body 텍스트가 pattern(정규식)에 매치되면 통과
  - text_regex_count_min   : body 텍스트에서 pattern에 매치되는 횟수가 min 이상이면 통과
  - text_or_value_regex    : body 텍스트 + 입력창/output 값까지 합쳐서 pattern 매치 (계산기 표시창 등)
  - computed_style_any     : selector 요소 중 실제 적용된 스타일(getComputedStyle)의 property에
                             value가 들어간 요소가 하나라도 있으면 통과
  - js                     : 페이지에서 expr(JS 식)을 평가해 참이면 통과
  - not                    : check가 실패하면 통과 (삭제 후 사라졌는지 등)
  - any_of                 : checks 목록 중 하나라도 통과하면 통과 (조건 완화용)

각 run_check 호출은 {"passed": bool, "detail": str}를 돌려줌.

행동 테스트(actions): 체크 항목에 "actions"가 있으면 그 항목만 새 페이지를 열어
액션을 순서대로 실행한 뒤 채점함(항목끼리 상태가 섞이지 않음). 액션이 하나라도
실패하면(버튼이 없음 등) 그 항목은 실패. 스펙 최상위 "setup_actions"는 actions가
없는 항목들이 공유하는 페이지에 한 번 실행됨.

액션 타입:
  - fill / click / press : selector(또는 우선순위 목록 selectors)의 첫 요소에 입력/클릭/키 입력
  - click_text           : 텍스트가 정확히 texts 중 하나인 버튼을 클릭 (계산기 "7", "+" 등)
  - expect_text          : 본문에 text가 없으면 실패 (중간 단계가 됐는지 확인)
  - js                   : code(JS)를 실행 (상태 저장 등)
  - reload / wait / set_viewport

alert/confirm은 페이지 로드 전에 window.__dialogs에 기록되도록 바꿔둠 —
"빈 칸 제출 시 경고" 같은 피드백을 js 체크에서 확인할 수 있고, 채점이 막히지도 않음.
"""
import re

DIALOG_CAPTURE = """
window.__dialogs = [];
window.alert = (m) => { window.__dialogs.push(String(m ?? '')); };
window.confirm = (m) => { window.__dialogs.push(String(m ?? '')); return true; };
window.prompt = (m) => { window.__dialogs.push(String(m ?? '')); return ''; };
"""

ACTION_TIMEOUT_MS = 3000  # 요소가 없을 때 Playwright 기본 30초를 기다리지 않도록


def open_page(browser, url: str, viewport: dict, console_errors: list = None):
    page = browser.new_page(viewport=viewport)
    page.set_default_timeout(ACTION_TIMEOUT_MS)
    page.add_init_script(DIALOG_CAPTURE)
    if console_errors is not None:
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
        page.on("pageerror", lambda exc: console_errors.append(str(exc)))
    page.goto(url)
    page.wait_for_timeout(500)  # JS onload/렌더링 여유
    return page


def _first_match(page, action: dict):
    selectors = action.get("selectors") or [action["selector"]]
    for sel in selectors:
        loc = page.locator(sel)
        if loc.count() > 0:
            return loc.first
    raise ValueError(f"요소 없음: {selectors}")


def _click_text(page, texts: list[str]):
    for t in texts:
        loc = page.get_by_role("button", name=t, exact=True)
        if loc.count() > 0:
            loc.first.click()
            return
        # div/span에 onclick을 단 계산기 등 — 텍스트가 정확히 t인 요소 중 가장 안쪽 것
        loc = page.locator("[onclick], [class*=btn], [class*=key], td, span, div").filter(
            has_text=re.compile(rf"^\s*{re.escape(t)}\s*$")
        )
        if loc.count() > 0:
            loc.last.click()
            return
    raise ValueError(f"텍스트가 {texts} 중 하나인 버튼 없음")


def run_setup_action(page, action: dict):
    atype = action["type"]
    if atype == "fill":
        _first_match(page, action).fill(action["value"])
    elif atype == "click":
        _first_match(page, action).click()
    elif atype == "press":
        _first_match(page, action).press(action["key"])
    elif atype == "click_text":
        _click_text(page, action["texts"])
    elif atype == "expect_text":
        if action["text"] not in page.inner_text("body"):
            raise ValueError(f"본문에 '{action['text']}' 없음")
    elif atype == "js":
        page.evaluate(action["code"])
    elif atype == "reload":
        page.reload()
        page.wait_for_timeout(300)
    elif atype == "wait":
        page.wait_for_timeout(action["ms"])
    elif atype == "set_viewport":
        page.set_viewport_size({"width": action["width"], "height": action["height"]})
    else:
        raise ValueError(f"알 수 없는 action type: {atype}")


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

    if ctype == "text_or_value_regex":
        # 계산기 표시창처럼 <input value>에 결과가 들어가는 경우 inner_text엔 안 잡혀서 값까지 합침
        text = page.evaluate(
            """() => document.body.innerText + '\\n' +
                [...document.querySelectorAll('input, textarea, output')].map(e => e.value).join('\\n')"""
        )
        m = re.search(check["pattern"], text)
        return {"passed": m is not None, "detail": f"match={m.group(0) if m else None}"}

    if ctype == "computed_style_any":
        # 클래스 토글이든 인라인 style이든 "input:checked ~ span" 같은 CSS 선택자든,
        # 구현 방식과 무관하게 브라우저가 실제로 적용한 스타일로 판정
        count = page.evaluate(
            """([sel, prop, val]) => [...document.querySelectorAll(sel)]
                .filter(el => getComputedStyle(el).getPropertyValue(prop).includes(val)).length""",
            [check["selector"], check["property"], check["value"]],
        )
        return {"passed": count >= 1, "detail": f"count={count}"}

    if ctype == "js":
        value = page.evaluate(f"() => {{ {check['expr']} }}")
        return {"passed": bool(value), "detail": f"value={value!r}"}

    if ctype == "not":
        inner = run_check(page, check["check"])
        return {"passed": not inner["passed"], "detail": f"not({inner['detail']})"}

    if ctype == "any_of":
        results = [run_check(page, sub) for sub in check["checks"]]
        return {
            "passed": any(r["passed"] for r in results),
            "detail": "; ".join(r["detail"] for r in results),
        }

    raise ValueError(f"알 수 없는 check type: {ctype}")


def grade_checklist(browser, page, url: str, viewport: dict, checklist: list[dict],
                    setup_actions: list[dict], console_errors: list) -> list[dict]:
    """이미 열려 있는 page(스크린샷까지 찍은 상태)로 체크리스트를 채점.
    actions가 있는 항목은 새 페이지에서 따로 실행 — 콘솔 에러는 메인 페이지 것만 셈
    (항목마다 같은 에러가 중복 집계되지 않도록)."""
    for action in setup_actions or []:
        try:
            run_setup_action(page, action)
            page.wait_for_timeout(200)
        except Exception as e:
            console_errors.append(f"setup_action 실패 {action}: {e}")

    results = []
    for item in checklist:
        try:
            if item.get("actions"):
                p = open_page(browser, url, viewport)
                try:
                    for action in item["actions"]:
                        try:
                            run_setup_action(p, action)
                        except Exception as e:
                            raise RuntimeError(f"action 실패 {action.get('type')}: {e}") from None
                        p.wait_for_timeout(200)
                    result = run_check(p, item)
                finally:
                    p.close()
            else:
                result = run_check(page, item)
        except Exception as e:  # 체크 자체가 깨져도 파일럿 전체가 죽지 않게
            result = {"passed": False, "detail": str(e)[:300]}
        results.append({"id": item["id"], "description": item["description"], **result})
    return results
