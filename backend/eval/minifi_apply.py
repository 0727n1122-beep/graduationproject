"""
minifi_apply.py — 사용자가 화면에서 "전체 첨삭 반영"을 눌렀을 때 복사하게 되는 최종 프롬프트를
/optimize 응답으로부터 똑같이 조립함.

frontend/src/lib/diagnosisEngine.ts(locateSnippet / resolvePositions / buildDisplaySegments /
assembleFinalText / monoStepsText)와 DiagnosisCards.tsx의 applyAll()을 그대로 옮긴 것:
  - 모든 이슈를 적용 (MONOLITHIC_REQUEST는 단계 문구로, 삭제형은 빈 문자열로, 나머지는 replacement로)
  - 빠진 조건은 확신도가 high/rec이고 suggested_phrase가 있는 것만 켬 (low는 사용자가 골라야 해서 꺼진 채)
  - 켜진 조건은 맨 뒤에 "\\n\\n[조건] " + 문장들로 붙음

백엔드의 optimized_prompt(모델이 따로 통째로 다시 쓴 문장)는 화면의 최종 프롬프트와 다르다 —
평가는 실제로 사용자가 쓰게 되는 이 조립본으로 해야 함.
"""
import re


def locate_snippet(text: str, snippet: str, occurrence: int):
    if not text or not snippet:
        return None
    occ = occurrence if isinstance(occurrence, int) else 0
    if occ < 0:
        return None
    from_index = 0
    found = -1
    for _ in range(occ + 1):
        found = text.find(snippet, from_index)
        if found == -1:
            return None
        from_index = found + 1
    return found, found + len(snippet)


def resolve_positions(prompt: str, issues: list[dict]) -> list[dict]:
    with_pos = []
    for issue in issues:
        loc = locate_snippet(prompt, issue.get("snippet") or "", issue.get("occurrence") or 0)
        if loc:
            with_pos.append({**issue, "start": loc[0], "end": loc[1]})
    with_pos.sort(key=lambda i: (i["start"], i["end"]))
    ordered, last_end = [], -1
    for issue in with_pos:
        if issue["start"] < last_end:
            continue  # 겹치는 이슈는 프론트도 버림
        ordered.append(issue)
        last_end = issue["end"]
    return ordered


def mono_steps_text(steps: list[dict]) -> str:
    if not steps:
        return "다음 순서로 단계별로 진행해주세요 — (단계 없음)"
    return "다음 순서로 단계별로 진행해주세요 — " + ", ".join(f"{i + 1}) {s.get('title', '')}" for i, s in enumerate(steps))


def applied_text(issue: dict) -> str:
    if issue.get("scope") == "structural":
        return mono_steps_text(issue.get("steps") or [])
    if issue.get("replacement") == "":
        return ""
    return issue.get("replacement") or ""


def assemble_applied(prompt: str, response: dict) -> str:
    """'전체 첨삭 반영' 상태의 최종 프롬프트."""
    parts, cursor = [], 0
    for issue in resolve_positions(prompt, response.get("issues") or []):
        if issue["start"] > cursor:
            parts.append(prompt[cursor:issue["start"]])
        parts.append(applied_text(issue))
        cursor = issue["end"]
    if cursor < len(prompt):
        parts.append(prompt[cursor:])
    text = "".join(parts)
    text = re.sub(r"\s+([,.])", r"\1", text)
    text = re.sub(r"[ \t]{2,}", " ", text).strip()
    active = [m["suggested_phrase"] for m in response.get("missing_constraints") or []
              if m.get("confidence") != "low" and m.get("suggested_phrase")]
    if active:
        text += "\n\n[조건] " + " ".join(active)
    return text
