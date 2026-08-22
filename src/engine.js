// ============================================================
// Minifi v5 스키마 진단 엔진 (순수 로직부)
// - DOM에 의존하지 않음 → Node에서 그대로 단위 테스트 가능
// - 브라우저 <script>에 그대로 붙여넣어도 동작 (module 가드 처리)
// ============================================================

/**
 * 원본 텍스트에서 snippet이 등장하는 모든 위치를 찾아
 * occurrence번째(0-based) 위치의 {start,end}를 반환한다.
 * 못 찾으면 null (백엔드의 "snippet 존재 검증 실패 → 드롭"과 동일한 개념을
 * 프론트에서도 방어적으로 한 번 더 체크).
 */
function locateSnippet(text, snippet, occurrence) {
  if (typeof text !== "string" || typeof snippet !== "string" || snippet.length === 0) {
    return null;
  }
  const occ = Number.isInteger(occurrence) ? occurrence : 0;
  if (occ < 0) return null;

  let fromIndex = 0;
  let found = -1;
  for (let count = 0; count <= occ; count++) {
    found = text.indexOf(snippet, fromIndex);
    if (found === -1) return null;
    fromIndex = found + 1; // 다음 탐색은 한 글자만 이동 — snippet끼리 겹치는 경우도 놓치지 않기 위함
    if (count < occ) continue;
  }
  return { start: found, end: found + snippet.length };
}

/** id를 onclick="fn('id')" 형태로 HTML 문자열에 그대로 심어도 안전한지 체크.
 *  (따옴표류가 섞여 있으면 마크업이 깨질 수 있어 방어적으로 재부여 대상으로 취급) */
function isSafeId(id) {
  return typeof id === "string" && id.length > 0 && !/['"<>\\]/.test(id);
}

/**
 * issues[]에 id가 없거나 중복되거나 안전하지 않으면(따옴표 포함 등) 백엔드와 동일한
 * 규칙(i{n})으로 재부여.
 * (백엔드가 이미 이 작업을 하지만, 프론트도 방어적으로 한 번 더 — 테스트 픽스처가
 *  깨져 있거나 미래에 다른 소스에서 데이터가 들어와도 안전하도록)
 */
function normalizeIssues(rawIssues) {
  const seen = new Set();
  let counter = 1;
  const nextFreeId = () => {
    let id = "i" + counter;
    while (seen.has(id)) { counter++; id = "i" + counter; }
    counter++;
    return id;
  };
  return (rawIssues || []).map((raw) => {
    const issue = Object.assign({}, raw);
    if (!isSafeId(issue.id) || seen.has(issue.id)) {
      issue.id = nextFreeId();
    }
    seen.add(issue.id);
    if (typeof issue.occurrence !== "number") issue.occurrence = 0;
    return issue;
  });
}

/**
 * missing_constraints[]는 이제 백엔드가 id(mc1, mc2...)를 부여해서 내려준다(issues와 동일 패턴).
 * 프론트는 그 id를 그대로 쓰고, 없거나(구버전 API) 안전하지 않거나(따옴표 등) 중복인 경우에만
 * 합성 id로 폴백한다. 초기 on/phrase 상태를 confidence 규칙대로 세팅하는 것은 기존과 동일.
 *
 * 방어 규칙(백엔드 검증 로직 6장과 동일한 것을 프론트에도 한 번 더):
 *  - confidence가 high/rec/low가 아니면 low로 강제
 *  - low인데 suggested_value/suggested_phrase가 있으면 강제로 null 처리
 */
function normalizeMissingConstraints(rawList) {
  const seen = new Set();
  return (rawList || []).map((raw, idx) => {
    const mc = Object.assign({}, raw);
    const fieldSlug = mc.field ? String(mc.field).replace(/[^\w가-힣]+/g, "_") : "x";
    let id = raw.id;
    if (!isSafeId(id) || seen.has(id)) {
      // 백엔드 id가 없거나(구버전 API) 안전하지 않거나 중복될 때만 합성 id로 폴백
      id = "mc_" + idx + "_" + fieldSlug;
    }
    seen.add(id);
    mc._id = id;
    if (!["high", "rec", "low"].includes(mc.confidence)) mc.confidence = "low";
    if (mc.confidence === "low") {
      mc.suggested_value = null;
      mc.suggested_phrase = null;
      if (!Array.isArray(mc.options)) mc.options = [];
    } else {
      if (!("suggested_value" in mc)) mc.suggested_value = null;
      if (!("suggested_phrase" in mc)) mc.suggested_phrase = null;
    }
    // 편집 가능한 working state — "실무 팁": suggested_phrase 자체를 통째로 편집하게 함
    // (짧은 value → 문장 템플릿 변환을 프론트가 하드코딩하지 않는다. 연동 가이드 6-2 참고)
    mc.phrase = mc.confidence === "low" ? null : (mc.suggested_phrase || null);
    mc.on = mc.confidence !== "low" && !!mc.phrase;
    return mc;
  });
}

/**
 * prompt 원문 + issues[]를 받아 각 이슈의 {start,end}를 계산한다.
 * - snippet을 원문에서 못 찾거나 occurrence가 범위를 벗어나면 dropped로 분류(표시하지 않음)
 * - 서로 겹치는 범위가 있으면(비정상 응답 방어) 먼저 등장하는(=start가 앞선) 이슈만 남기고
 *   나머지는 overlapDropped로 분류
 */
function resolvePositions(prompt, issues) {
  const withPos = [];
  const dropped = [];
  for (const issue of issues) {
    const loc = locateSnippet(prompt, issue.snippet, issue.occurrence || 0);
    if (!loc) { dropped.push(issue); continue; }
    withPos.push(Object.assign({}, issue, { start: loc.start, end: loc.end }));
  }
  withPos.sort((a, b) => a.start - b.start || a.end - b.end);

  const ordered = [];
  const overlapDropped = [];
  let lastEnd = -1;
  for (const issue of withPos) {
    if (issue.start < lastEnd) { overlapDropped.push(issue); continue; }
    ordered.push(issue);
    lastEnd = issue.end;
  }
  return { ordered, dropped, overlapDropped };
}

/**
 * "뒤에서 앞 순서로 잘라야 밀리지 않는다"는 함정을 아예 구조적으로 피하는 방식.
 * → 원본 문자열을 절대 직접 이어붙이지 않고, ORIGINAL 텍스트 기준 절대 위치(start/end)를
 *   오름차순으로 커서(cursor)를 옮겨가며 "세그먼트 배열"만 만든다.
 *   이 방식은 앞→뒤로 훑어도 위치가 밀리지 않는다 — 매번 원본 문자열의 절대 인덱스를
 *   기준으로만 자르기 때문에(중간에 문자열 길이가 바뀌는 시점이 없음).
 *
 * (뒤→앞 방식이 실제로 필요한 경우는 spliceReplacementsBackToFront 참고 — 그 함수는
 *  "적용 후 완성 문장"을 세그먼트 배열 없이 원본 문자열에 직접 치환해 넣는, 더 위험한
 *  구현 방식을 보여주기 위한 대조군이다. 두 방식이 같은 결과를 내는지 테스트로 교차검증한다.)
 */
function buildDisplaySegments(prompt, orderedIssues) {
  const segments = [];
  let cursor = 0;
  for (const issue of orderedIssues) {
    if (issue.start > cursor) {
      segments.push({ type: "text", text: prompt.slice(cursor, issue.start) });
    }
    segments.push({ type: "issue", issue });
    cursor = issue.end;
  }
  if (cursor < prompt.length) {
    segments.push({ type: "text", text: prompt.slice(cursor) });
  }
  return segments;
}

/** 세그먼트를 다시 원문으로 되돌렸을 때 원본과 100% 일치하는지 (round-trip 검증용) */
function segmentsToRawText(segments) {
  return segments.map((s) => (s.type === "text" ? s.text : s.issue.snippet)).join("");
}

/** MONOLITHIC_REQUEST steps[]로부터 "다음 순서로 단계별로 진행해주세요 — ..." 문구 생성.
 *  desc는 계획 미리보기에만 쓰이고 최종 문구 조립에는 title만 사용한다(연동 가이드 5장). */
function monoStepsText(steps) {
  const on = (steps || []).filter((s) => s.on);
  if (!on.length) return "다음 순서로 단계별로 진행해주세요 — (단계 없음)";
  return "다음 순서로 단계별로 진행해주세요 — " + on.map((s, i) => (i + 1) + ") " + s.title).join(", ");
}

/** scope가 structural인 카테고리는 이제 MONOLITHIC_REQUEST 하나뿐이지만,
 *  카테고리 이름을 하드코딩해서 분기하지 않는다 — 반드시 issue.scope 필드를 그대로 읽는다.
 *  (연동 가이드의 "프론트가 자체 목록을 갖고 있으면 안 된다" 경고 반영) */
function isStructural(issue) {
  return issue.scope === "structural";
}

/** AMBIGUOUS만 편집 가능한 입력창을 가진다 (연동 가이드 3장) */
function isEditable(issue) {
  return !isStructural(issue) && issue.category === "AMBIGUOUS" && typeof issue.replacement === "string";
}

/** FILLER는 항상 replacement==="" (삭제). 다른 카테고리가 실수로 빈 문자열을 주는 경우도 방어적으로 같이 처리 */
function isDeleteIssue(issue) {
  return !isStructural(issue) && issue.replacement === "";
}

/** 밑줄 색상 그룹 — 연동 가이드 2장 표 그대로.
 *  카테고리가 늘어나도(예: 새 카테고리 추가) 이 매핑 하나만 고치면 됨 — render 로직은 그대로. */
function styleGroupFor(category) {
  if (category === "FILLER" || category === "REDUNDANT") return "faint";
  if (category === "MONOLITHIC_REQUEST") return "mono";
  // AMBIGUOUS, CODE_DUMP, UNSTRUCTURED + 알 수 없는 카테고리는 안전하게 strong으로
  return "strong";
}

/** 팝오버 안에 원문을 보여줄 때 CODE_DUMP/UNSTRUCTURED처럼 긴 snippet은 잘라서 보여준다.
 *  (실제 밑줄/치환 로직에는 영향 없음 — 표시 전용) */
function truncateForDisplay(text, maxLen) {
  maxLen = maxLen || 110;
  const t = String(text).trim();
  if (t.length <= maxLen) return t;
  return t.slice(0, maxLen).trim() + " …";
}

/**
 * 현재 상태(각 이슈의 status/replacement, monoSteps on/off, missing_constraints on/phrase)를
 * 반영해 "완료" 화면의 최종 문구를 만든다. 세그먼트 배열을 그대로 순회하므로
 * (원본 문자열을 다시 자르지 않으므로) 위치가 밀릴 일이 구조적으로 없다.
 */
function assembleFinalText(prompt, segments, missingConstraints) {
  const parts = segments.map((seg) => {
    if (seg.type === "text") return seg.text;
    const issue = seg.issue;
    if (issue.status === "applied") {
      if (isStructural(issue)) return monoStepsText(issue._monoSteps || []);
      if (isDeleteIssue(issue)) return "";
      return typeof issue._editedReplacement === "string" ? issue._editedReplacement : issue.replacement;
    }
    return issue.snippet; // 건너뛰기/미처리 → 원문 유지
  });
  let text = parts.join("").replace(/\s+([,.])/g, "$1").replace(/[ \t]{2,}/g, " ").trim();
  const activeMiss = (missingConstraints || []).filter((m) => m.on && m.phrase);
  if (activeMiss.length) {
    text += "\n\n[조건] " + activeMiss.map((m) => m.phrase).join(" ");
  }
  return text;
}

/**
 * 대조군: 세그먼트 배열 없이 "원본 문자열에 직접 치환해 넣는" 방식을 구현하면
 * 반드시 뒤(높은 offset)에서 앞(낮은 offset) 순서로 잘라야 한다는 것을 보여주는 함수.
 * assembleFinalText와 같은 입력에 대해 같은 결과가 나오는지 테스트에서 교차검증한다.
 */
function spliceReplacementsBackToFront(prompt, orderedIssuesWithState) {
  // 반드시 내림차순(뒤에서부터)으로 처리 — 앞에서부터 자르면 길이가 바뀌면서
  // 아직 처리 안 한 뒤쪽 이슈의 start/end(원본 기준 절대 좌표)가 더 이상 유효하지 않게 된다.
  const desc = orderedIssuesWithState.slice().sort((a, b) => b.start - a.start);
  let text = prompt;
  for (const issue of desc) {
    let repl;
    if (issue.status === "applied") {
      if (isStructural(issue)) repl = monoStepsText(issue._monoSteps || []);
      else if (isDeleteIssue(issue)) repl = "";
      else repl = typeof issue._editedReplacement === "string" ? issue._editedReplacement : issue.replacement;
    } else {
      repl = issue.snippet;
    }
    text = text.slice(0, issue.start) + repl + text.slice(issue.end);
  }
  return text.replace(/\s+([,.])/g, "$1").replace(/[ \t]{2,}/g, " ").trim();
}

function esc(str) {
  return String(str).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    locateSnippet,
    isSafeId,
    normalizeIssues,
    normalizeMissingConstraints,
    resolvePositions,
    buildDisplaySegments,
    segmentsToRawText,
    monoStepsText,
    isStructural,
    isEditable,
    isDeleteIssue,
    styleGroupFor,
    truncateForDisplay,
    assembleFinalText,
    spliceReplacementsBackToFront,
    esc,
  };
}
