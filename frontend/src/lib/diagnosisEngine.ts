// ============================================================
// diagnosisEngine.ts — 진단 UI의 순수 로직부.
// docs/minifi-diagnosis-mockup-v4_1.html의 engine.js를 v5 스키마 기준으로
// 그대로 포팅한 것 (DOM에 의존하지 않음 → 단위 테스트 가능).
// ============================================================

import type {
  Issue,
  IssueCategory,
  IssueState,
  MissingConstraintState,
  MonoStepState,
  Segment,
} from "@/types/diagnosis";

/**
 * 원본 텍스트에서 snippet이 등장하는 모든 위치를 찾아
 * occurrence번째(0-based) 위치의 {start,end}를 반환한다.
 * 못 찾으면 null.
 */
export function locateSnippet(
  text: string,
  snippet: string,
  occurrence: number,
): { start: number; end: number } | null {
  if (!text || !snippet) return null;
  const occ = Number.isInteger(occurrence) ? occurrence : 0;
  if (occ < 0) return null;

  let fromIndex = 0;
  let found = -1;
  for (let count = 0; count <= occ; count++) {
    found = text.indexOf(snippet, fromIndex);
    if (found === -1) return null;
    fromIndex = found + 1; // 다음 탐색은 한 글자만 이동 — snippet끼리 겹치는 경우도 놓치지 않기 위함
  }
  return { start: found, end: found + snippet.length };
}

/**
 * prompt 원문 + issues[]를 받아 각 이슈의 {start,end}를 계산한다.
 * - snippet을 원문에서 못 찾으면 dropped로 분류(표시하지 않음)
 * - 서로 겹치는 범위가 있으면(비정상 응답 방어) 먼저 등장하는 이슈만 남기고 나머지는 overlapDropped
 */
export function resolvePositions(
  prompt: string,
  issues: Issue[],
): { ordered: IssueState[]; dropped: Issue[]; overlapDropped: IssueState[] } {
  const withPos: IssueState[] = [];
  const dropped: Issue[] = [];
  for (const issue of issues) {
    const loc = locateSnippet(prompt, issue.snippet, issue.occurrence || 0);
    if (!loc) {
      dropped.push(issue);
      continue;
    }
    withPos.push({ ...issue, start: loc.start, end: loc.end });
  }
  withPos.sort((a, b) => a.start - b.start || a.end - b.end);

  const ordered: IssueState[] = [];
  const overlapDropped: IssueState[] = [];
  let lastEnd = -1;
  for (const issue of withPos) {
    if (issue.start < lastEnd) {
      overlapDropped.push(issue);
      continue;
    }
    ordered.push(issue);
    lastEnd = issue.end;
  }
  return { ordered, dropped, overlapDropped };
}

/**
 * 원본 문자열을 절대 직접 이어붙이지 않고, ORIGINAL 텍스트 기준 절대 위치(start/end)를
 * 오름차순으로 커서를 옮겨가며 세그먼트 배열만 만든다. 위치가 밀리지 않는다.
 */
export function buildDisplaySegments(prompt: string, orderedIssues: IssueState[]): Segment[] {
  const segments: Segment[] = [];
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

/** scope가 structural인 카테고리는 MONOLITHIC_REQUEST뿐이지만, 카테고리 이름을
 *  하드코딩해서 분기하지 않는다 — 반드시 issue.scope 필드를 그대로 읽는다. */
export function isStructural(issue: Pick<Issue, "scope">): boolean {
  return issue.scope === "structural";
}

/** AMBIGUOUS만 편집 가능한 입력창을 가진다 */
export function isEditable(issue: Issue): boolean {
  return !isStructural(issue) && issue.category === "AMBIGUOUS" && typeof issue.replacement === "string";
}

/** FILLER는 항상 replacement==="" (삭제). 다른 카테고리가 실수로 빈 문자열을 주는 경우도 방어적으로 같이 처리 */
export function isDeleteIssue(issue: Issue): boolean {
  return !isStructural(issue) && issue.replacement === "";
}

/** 밑줄 색상 그룹. 카테고리가 늘어나도 이 매핑 하나만 고치면 된다. */
export function styleGroupFor(category: IssueCategory): "faint" | "mono" | "strong" {
  if (category === "FILLER" || category === "REDUNDANT") return "faint";
  if (category === "MONOLITHIC_REQUEST") return "mono";
  // AMBIGUOUS, CODE_DUMP, UNSTRUCTURED + 알 수 없는 카테고리는 안전하게 strong으로
  return "strong";
}

/** 팝오버 안에 원문/치환문을 보여줄 때 CODE_DUMP/UNSTRUCTURED처럼 긴 텍스트는 잘라서 보여준다.
 *  (실제 밑줄/치환 로직에는 영향 없음 — 표시 전용) */
export function truncateForDisplay(text: string, maxLen = 110): string {
  const t = (text ?? "").trim();
  if (t.length <= maxLen) return t;
  return t.slice(0, maxLen).trim() + " …";
}

/** MONOLITHIC_REQUEST steps[]로부터 "다음 순서로 단계별로 진행해주세요 — ..." 문구 생성. */
export function monoStepsText(steps: MonoStepState[]): string {
  const on = (steps || []).filter((s) => s.on);
  if (!on.length) return "다음 순서로 단계별로 진행해주세요 — (단계 없음)";
  return "다음 순서로 단계별로 진행해주세요 — " + on.map((s, i) => `${i + 1}) ${s.title}`).join(", ");
}

/**
 * 현재 상태(각 이슈의 status/replacement, monoSteps on/off, missing_constraints on/phrase)를
 * 반영해 최종 문구를 조립한다. 세그먼트 배열을 그대로 순회하므로 위치가 밀릴 일이 없다.
 */
export function assembleFinalText(segments: Segment[], missing: MissingConstraintState[]): string {
  const parts = segments.map((seg) => {
    if (seg.type === "text") return seg.text;
    const issue = seg.issue;
    if (issue.status === "applied") {
      if (isStructural(issue)) return monoStepsText(issue.monoSteps || []);
      if (isDeleteIssue(issue)) return "";
      return typeof issue.editedReplacement === "string" ? issue.editedReplacement : (issue.replacement ?? "");
    }
    return issue.snippet; // 건너뛰기/미처리 → 원문 유지
  });
  let text = parts.join("").replace(/\s+([,.])/g, "$1").replace(/[ \t]{2,}/g, " ").trim();
  const activeMiss = (missing || []).filter((m) => m.on && m.phrase);
  if (activeMiss.length) {
    text += "\n\n[조건] " + activeMiss.map((m) => m.phrase).join(" ");
  }
  return text;
}

/** 데모용 근사치 — v5 API는 issue별 토큰 절감치를 내려주지 않으므로(스키마에 없음),
 *  "완성된 텍스트 전/후"를 직접 추정해서 비교한다. */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.max(1, Math.ceil(text.length / 2.5));
}

export interface Grade {
  letter: string;
  pct: number;
  msg: string;
}

export function gradeFor(frac: number): Grade {
  if (frac >= 0.999) return { letter: "A+", pct: 1, msg: "첨삭 끝! 이대로 보내도 좋아요." };
  if (frac >= 0.9) return { letter: "A-", pct: frac, msg: "거의 다 됐어요. 한두 개만 더 봐주세요." };
  if (frac >= 0.7) return { letter: "B+", pct: frac, msg: "꽤 깔끔해졌어요. 조금만 더요." };
  if (frac >= 0.5) return { letter: "B", pct: frac, msg: "절반 넘게 고쳤어요. 계속 가볼까요." };
  if (frac >= 0.25) return { letter: "C+", pct: frac, msg: "군더더기·중복이 아직 남아있어요." };
  if (frac > 0) return { letter: "C", pct: frac, msg: "이제 막 시작했어요. 밑줄을 눌러보세요." };
  return { letter: "C", pct: 0, msg: "밑줄을 눌러 하나씩 고쳐보세요." };
}

/** 등급 링(원형 게이지) 색 — 아쿠아블루 테마: 잘 고쳤을수록 아쿠아, 아니면 경고색. */
export function ringColorFor(pct: number): string {
  if (pct >= 0.7) return "#00C9C8";
  if (pct >= 0.35) return "#E0A23C";
  return "#D6746B";
}

// ── 모델별 비용 비교 (백엔드 main.py의 MODELS·calculate_costs와 동일한 가격/공식) ──
export interface ModelPricing {
  key: string;
  name: string;
  /** 1M 토큰당 USD */
  input: number;
  output: number;
}

export const MODEL_PRICING: ModelPricing[] = [
  { key: "claude-opus-4", name: "Opus", input: 15, output: 75 },
  { key: "claude-sonnet-4", name: "Sonnet", input: 3, output: 15 },
  { key: "claude-haiku-3-5", name: "Haiku", input: 0.8, output: 4 },
  { key: "gpt-4o", name: "GPT-4o", input: 2.5, output: 10 },
  { key: "gpt-4o-mini", name: "GPT-mini", input: 0.15, output: 0.6 },
  { key: "gemini-2-5-pro", name: "Gem-Pro", input: 1.25, output: 10 },
  { key: "gemini-2-5-flash", name: "Gem-Flash", input: 0.15, output: 0.6 },
  // estimateCost와 동일한 가중치(입력 1x + 출력 2x)로 정렬 — 저렴한 모델이 위로.
].sort((a, b) => a.input + 2 * a.output - (b.input + 2 * b.output));

/** 백엔드 calculate_costs와 동일한 공식: 입력 토큰 비용 + (출력 토큰을 입력의 2배로 가정한) 출력 비용 */
export function estimateCost(tokens: number, pricing: ModelPricing): number {
  return (tokens / 1_000_000) * pricing.input + ((tokens * 2) / 1_000_000) * pricing.output;
}

/** 해결된 이슈 비율로 추정하는 예상 재프롬프팅(연쇄 수정) 횟수.
 *  v5 API가 직접 내려주는 값이 아니라 근사치 — mockup의 renderComplete 로직과 동일. */
export function iterationEstimate(totalIssues: number, resolvedCount: number): { before: number; after: number } {
  const resolvedFrac = totalIssues ? resolvedCount / totalIssues : 1;
  const before = Math.max(1, Math.round(totalIssues * 1.4) + 1);
  const after = Math.max(0, Math.round(before * (1 - resolvedFrac)));
  return { before, after };
}
