"use client";

// ============================================================
// DiagnosisCards.tsx — 진단 화면 (첨삭 노트 + 완료 화면)
// ------------------------------------------------------------
// docs/minifi_meta_prompt_v5.md(백엔드 /optimize 실제 응답 스키마) +
// docs/minifi-diagnosis-mockup-v4_1.html(검증된 engine.js 로직 + 실제 화면 마크업)을
// 기준으로 밑줄 클릭 팝오버 → 적용/치환 → 토큰·등급·비용 계산까지 구현.
// 아쿠아블루(#00C9C8/#0891B2) 테마 — AuthForm.tsx와 동일한 팔레트.
// ============================================================

import { useMemo, useState } from "react";
import type {
  Issue,
  IssueState,
  MissingConstraint,
  MissingConstraintState,
  MonoStepState,
  DiagnosisCardsProps,
} from "@/types/diagnosis";
import { CATEGORY_NAME } from "@/types/diagnosis";
import {
  assembleFinalText,
  buildDisplaySegments,
  estimateCost,
  estimateTokens,
  gradeFor,
  isDeleteIssue,
  isEditable,
  isStructural,
  iterationEstimate,
  MODEL_PRICING,
  monoStepsText,
  resolvePositions,
  ringColorFor,
  styleGroupFor,
  truncateForDisplay,
  type Grade,
} from "@/src/lib/diagnosisEngine";

function initIssues(prompt: string, issues: Issue[]): IssueState[] {
  const { ordered, dropped, overlapDropped } = resolvePositions(prompt, issues);
  if (dropped.length || overlapDropped.length) {
    // 정상 응답이면 발생하면 안 됨 — 백엔드가 이미 snippet 검증을 하기 때문.
    console.warn("[Minifi] 세그먼트 위치를 찾지 못해 드롭된 이슈:", { dropped, overlapDropped });
  }
  return ordered.map((issue) => ({
    ...issue,
    monoSteps: isStructural(issue) && issue.steps ? issue.steps.map((s) => ({ ...s, on: true })) : undefined,
  }));
}

function initMissing(list: MissingConstraint[]): MissingConstraintState[] {
  return list.map((mc) => ({
    ...mc,
    phrase: mc.confidence === "low" ? null : mc.suggested_phrase,
    on: mc.confidence !== "low" && !!mc.suggested_phrase,
    selectedOption: null,
  }));
}

type View = "diagnosis" | "complete";

export default function DiagnosisCards({ prompt, result, eyebrow = "03 · 첨삭 노트", subtitle }: DiagnosisCardsProps) {
  const [issues, setIssues] = useState<IssueState[]>(() => initIssues(prompt, result.issues));
  const [missing, setMissing] = useState<MissingConstraintState[]>(() => initMissing(result.missing_constraints));
  const [openId, setOpenId] = useState<string | null>(null);
  const [openMonoId, setOpenMonoId] = useState<string | null>(null);
  const [missExpanded, setMissExpanded] = useState(false);
  const [view, setView] = useState<View>("diagnosis");

  const segments = useMemo(() => buildDisplaySegments(prompt, issues), [prompt, issues]);
  const finalText = useMemo(() => assembleFinalText(segments, missing), [segments, missing]);
  const beforeTok = useMemo(() => estimateTokens(prompt), [prompt]);
  const afterTok = useMemo(() => estimateTokens(finalText), [finalText]);

  const totalIssues = issues.length;
  const resolved = issues.filter((i) => i.status === "applied").length;
  const frac = totalIssues ? resolved / totalIssues : 1;
  const grade = gradeFor(frac);
  const monoIssue = openMonoId ? (issues.find((i) => i.id === openMonoId) ?? null) : null;
  const activeMiss = missing.filter((m) => m.on && m.phrase);

  function patchIssue(id: string, patch: Partial<IssueState>) {
    setIssues((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  function apply(id: string) {
    const issue = issues.find((i) => i.id === id);
    if (!issue || issue.status) return;
    patchIssue(id, { status: "applied" });
    setOpenId(null);
  }
  function skip(id: string) {
    const issue = issues.find((i) => i.id === id);
    if (!issue || issue.status) return;
    patchIssue(id, { status: "skipped" });
    setOpenId(null);
  }
  function applyEdited(id: string, value: string) {
    const v = value.trim();
    patchIssue(id, v ? { editedReplacement: v, status: "applied" } : { status: "applied" });
    setOpenId(null);
  }

  function openMonoPanel(id: string) {
    setOpenId(null);
    setOpenMonoId(id);
  }
  function applyMono(id: string) {
    const issue = issues.find((i) => i.id === id);
    if (!issue || issue.status) return;
    patchIssue(id, { status: "applied", monoSteps: (issue.monoSteps ?? []).map((s) => ({ ...s, on: true })) });
  }
  function undoMono(id: string) {
    const issue = issues.find((i) => i.id === id);
    if (!issue) return;
    patchIssue(id, { status: undefined, monoSteps: (issue.monoSteps ?? []).map((s) => ({ ...s, on: true })) });
    setOpenMonoId(null);
  }
  function toggleMonoStep(id: string, idx: number) {
    setIssues((prev) =>
      prev.map((issue) => {
        if (issue.id !== id) return issue;
        const steps = issue.monoSteps ?? [];
        const onCount = steps.filter((s) => s.on).length;
        if (steps[idx].on && onCount <= 1) return issue; // 최소 1개는 켜져 있어야 함
        return { ...issue, monoSteps: steps.map((s, i) => (i === idx ? { ...s, on: !s.on } : s)) };
      }),
    );
  }

  function toggleMiss(id: string) {
    setMissing((prev) => prev.map((m) => (m.id === id ? { ...m, on: !m.on } : m)));
  }
  function editMissPhrase(id: string, raw: string) {
    const v = raw.trim();
    setMissing((prev) => prev.map((m) => (m.id === id ? { ...m, phrase: v || null, on: !!v } : m)));
  }
  function pickMissOption(id: string, oi: number) {
    setMissing((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        if (m.selectedOption === oi) return { ...m, selectedOption: null, phrase: null, on: false };
        const opt = m.options?.[oi];
        return { ...m, selectedOption: oi, phrase: opt?.phrase ?? null, on: !!opt?.phrase };
      }),
    );
  }
  function acceptRecommended() {
    setMissing((prev) => prev.map((m) => (m.confidence !== "low" ? { ...m, on: true } : m)));
  }

  function applyAll() {
    setIssues((prev) =>
      prev.map((issue) => {
        if (issue.status) return issue;
        if (isStructural(issue)) {
          return { ...issue, status: "applied", monoSteps: (issue.monoSteps ?? []).map((s) => ({ ...s, on: true })) };
        }
        return { ...issue, status: "applied" };
      }),
    );
    acceptRecommended();
    setOpenId(null);
    setOpenMonoId(null);
  }
  function resetAll() {
    setIssues(initIssues(prompt, result.issues));
    setMissing(initMissing(result.missing_constraints));
    setOpenId(null);
    setOpenMonoId(null);
    setMissExpanded(false);
  }

  const remaining = totalIssues - resolved;

  return (
    <div className="flex flex-col gap-[22px]">
      {/* ── 상단 바: 제목 + 등급 링 + 액션 ────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <div className="mb-1.5 font-mono text-[11px] font-extrabold tracking-[.08em] text-[#0891B2] uppercase">
            {view === "complete" ? "완료" : eyebrow}
          </div>
          <h1 className="text-[26px] font-extrabold tracking-tight text-[#182430]">
            {view === "complete" ? "첨삭 완료" : "프롬프트 첨삭"}
          </h1>
          <div className="mt-1 text-[12.5px] font-semibold text-[#9AA4B0]">
            {view === "complete" ? "최적화된 프롬프트와 예상 비용이에요" : (subtitle ?? "밑줄을 눌러 하나씩 고쳐보세요")}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3.5">
          {view === "diagnosis" && <GradeRing grade={grade} />}
          <div className="flex gap-2">
            {view === "complete" ? (
              <ActionButton onClick={() => setView("diagnosis")}>← 다시 편집</ActionButton>
            ) : (
              <>
                <ActionButton onClick={resetAll}>답안 되돌리기</ActionButton>
                <ActionButton onClick={applyAll} variant="primary">
                  전체 첨삭 반영
                </ActionButton>
                <ActionButton onClick={() => setView("complete")} variant="done">
                  완료
                </ActionButton>
              </>
            )}
          </div>
        </div>
      </div>

      {view === "complete" ? (
        <DiagnosisComplete finalText={finalText} beforeTok={beforeTok} afterTok={afterTok} totalIssues={totalIssues} resolved={resolved} />
      ) : (
        <>
          {/* ── 제출한 답안 ────────────── */}
          <div className="rounded-xl border border-[#E4E8EE] bg-white">
            <SheetHeader title="제출한 답안" hint={`issues: ${remaining} / ${totalIssues}`} />
            <div className="p-6 text-[17px] leading-[2.15]">
              {segments.map((seg, i) =>
                seg.type === "text" ? (
                  <span key={i}>{seg.text}</span>
                ) : (
                  <IssueMark
                    key={seg.issue.id}
                    issue={seg.issue}
                    open={openId === seg.issue.id}
                    onToggleOpen={() => setOpenId(openId === seg.issue.id ? null : seg.issue.id)}
                    onApply={() => apply(seg.issue.id)}
                    onSkip={() => skip(seg.issue.id)}
                    onApplyEdited={(v) => applyEdited(seg.issue.id, v)}
                    onOpenMonoPanel={() => openMonoPanel(seg.issue.id)}
                  />
                ),
              )}
              {activeMiss.length > 0 && (
                <>
                  {" "}
                  {activeMiss.map((m) => (
                    <span
                      key={m.id}
                      className="mr-1 inline-block rounded-md bg-[#E3F6EE] px-[7px] py-[1px] font-semibold text-[#0B8564] shadow-[inset_0_0_0_1px_#BFE7D8]"
                    >
                      <span className="mr-1 text-[10px] font-extrabold opacity-80">＋조건</span>
                      {m.phrase}
                    </span>
                  ))}
                </>
              )}
            </div>
            {monoIssue && (
              <div className="border-t border-dashed border-[#E4E8EE] p-5">
                <MonoPanel
                  issue={monoIssue}
                  onApply={() => applyMono(monoIssue.id)}
                  onUndo={() => undoMono(monoIssue.id)}
                  onToggleStep={(idx) => toggleMonoStep(monoIssue.id, idx)}
                />
              </div>
            )}
          </div>

          {/* ── 빠진 조건 ────────────── */}
          <div className="rounded-xl border border-[#E4E8EE] bg-white">
            <SheetHeader title="빠진 조건" hint="MISSING" />
            <div className="px-5 py-4">
              <MissingList
                missing={missing}
                expanded={missExpanded}
                onToggleExpand={() => setMissExpanded((v) => !v)}
                onToggle={toggleMiss}
                onEditPhrase={editMissPhrase}
                onPickOption={pickMissOption}
                feedback={result.feedback}
              />
              {missing.length > 0 && (
                <div className="mt-1.5 flex justify-end">
                  <button
                    onClick={acceptRecommended}
                    className="text-[11.5px] font-bold text-[#9AA4B0] hover:text-[#0891B2]"
                  >
                    추천 조건 한번에 채우기
                  </button>
                </div>
              )}
            </div>
          </div>

          <p className="px-0.5 text-[11.5px] leading-[1.6] font-semibold text-[#9AA4B0]">
            모든 수치는 <b className="text-[#5C6773]">예상값</b>이며, 실제 청구 금액은 각 모델 콘솔에서 확인한 값과 다를 수
            있어요. &lsquo;완료&rsquo;를 누르면 최적화된 프롬프트와 토큰·비용 내역을 볼 수 있어요.
          </p>
        </>
      )}
    </div>
  );
}

// ── 공용 UI 조각 ───────────────────────
function SheetHeader({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex items-center justify-between gap-2.5 border-b border-[#EEF1F4] px-5 py-3.5">
      <h2 className="text-[12.5px] font-extrabold tracking-[.01em] text-[#5C6773]">{title}</h2>
      <span className="font-mono text-[11.5px] font-bold text-[#9AA4B0]">{hint}</span>
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  variant = "ghost",
}: {
  children: React.ReactNode;
  onClick: () => void;
  variant?: "ghost" | "primary" | "done";
}) {
  const styles =
    variant === "primary"
      ? "bg-[#00C9C8] text-white hover:bg-[#0891B2]"
      : variant === "done"
        ? "bg-[#0B7285] text-white hover:bg-[#095E6E]"
        : "border border-[#E4E8EE] bg-white text-[#182430] hover:bg-[#F5F7F9]";
  return (
    <button onClick={onClick} className={`h-[37px] rounded-[9px] px-4 text-[12.5px] font-bold whitespace-nowrap ${styles}`}>
      {children}
    </button>
  );
}

function GradeRing({ grade }: { grade: Grade }) {
  const R = 19;
  const CIRC = 2 * Math.PI * R;
  const offset = CIRC * (1 - grade.pct);
  const color = ringColorFor(grade.pct);
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[#E4E8EE] bg-white py-[9px] pr-[18px] pl-[9px] shadow-[0_1px_3px_rgba(20,24,30,0.05)]">
      <div className="relative h-[46px] w-[46px] flex-none">
        <svg width="46" height="46" viewBox="0 0 46 46" className="-rotate-90">
          <circle cx="23" cy="23" r={R} fill="none" stroke="#E4E8EE" strokeWidth="5" />
          <circle
            cx="23"
            cy="23"
            r={R}
            fill="none"
            stroke={color}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset .3s ease, stroke .3s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-[15px] font-extrabold text-[#182430]">
          {grade.letter}
        </div>
      </div>
      <div className="leading-[1.3]">
        <div className="text-[10px] font-extrabold tracking-[.04em] text-[#9AA4B0] uppercase">현재 첨삭 점수</div>
        <div className="max-w-[150px] text-[12.5px] font-bold text-[#5C6773]">{grade.msg}</div>
      </div>
    </div>
  );
}

// ── 문제 구간 하나 = 밑줄 span (+ 클릭 시 팝오버) ───────────────────────
function IssueMark({
  issue,
  open,
  onToggleOpen,
  onApply,
  onSkip,
  onApplyEdited,
  onOpenMonoPanel,
}: {
  issue: IssueState;
  open: boolean;
  onToggleOpen: () => void;
  onApply: () => void;
  onSkip: () => void;
  onApplyEdited: (value: string) => void;
  onOpenMonoPanel: () => void;
}) {
  if (issue.status) {
    if (issue.status === "applied" && isDeleteIssue(issue)) return null; // 삭제 적용 → 렌더 안 함
    const display =
      issue.status === "applied"
        ? isStructural(issue)
          ? monoStepsText(issue.monoSteps ?? [])
          : (issue.editedReplacement ?? issue.replacement ?? "")
        : issue.snippet;
    return (
      <span
        className={
          issue.status === "applied"
            ? "rounded-[3px] bg-[#E3F6EE] px-[2px] text-[#182430] shadow-[inset_0_-2px_0_#BFE7D8] after:ml-[3px] after:text-[10px] after:font-extrabold after:text-[#0B8564] after:content-['✓']"
            : "text-[#9AA4B0]"
        }
      >
        {display}
      </span>
    );
  }

  const grp = styleGroupFor(issue.category);
  const underlineClass =
    grp === "faint"
      ? "decoration-dotted decoration-[1.5px] decoration-[#EFA6A8]"
      : grp === "mono"
        ? "rounded-[4px] bg-[#FCF6E7] px-1 decoration-solid decoration-[3px] decoration-[#C9860A]"
        : "decoration-wavy decoration-2 decoration-[#E5484D]";

  return (
    <span className="relative">
      <span
        role="button"
        tabIndex={0}
        onClick={onToggleOpen}
        className={[
          "cursor-pointer rounded-[3px] px-[2px]",
          "underline underline-offset-4 transition-colors",
          underlineClass,
          open ? "bg-[#E0F7F7]" : "",
        ].join(" ")}
      >
        {issue.snippet}
      </span>
      {open && (
        <IssuePopover
          issue={issue}
          onApply={onApply}
          onSkip={onSkip}
          onApplyEdited={onApplyEdited}
          onOpenMonoPanel={onOpenMonoPanel}
        />
      )}
    </span>
  );
}

// ── 밑줄 클릭 시 뜨는 팝오버 ───────────────────────
function IssuePopover({
  issue,
  onApply,
  onSkip,
  onApplyEdited,
  onOpenMonoPanel,
}: {
  issue: IssueState;
  onApply: () => void;
  onSkip: () => void;
  onApplyEdited: (value: string) => void;
  onOpenMonoPanel: () => void;
}) {
  const structural = isStructural(issue);
  const del = isDeleteIssue(issue);
  const editable = isEditable(issue);
  const [draft, setDraft] = useState(issue.editedReplacement ?? issue.replacement ?? "");
  const dotColor = styleGroupFor(issue.category) === "mono" ? "#C9860A" : "#E5484D";

  return (
    <span
      onClick={(e) => e.stopPropagation()}
      className="absolute top-[calc(100%+8px)] left-0 z-20 w-[272px] cursor-default rounded-xl border border-[#E4E8EE] bg-white px-[15px] py-[13px] text-[12.5px] leading-[1.55] font-medium text-[#182430] shadow-[0_16px_38px_rgba(15,18,24,0.14),0_2px_8px_rgba(15,18,24,0.06)]"
    >
      <div className="mb-2 flex items-center gap-1.5 font-mono text-[10.5px] font-extrabold tracking-wide uppercase">
        <span className="h-2 w-2 rounded-full" style={{ background: dotColor }} />
        {CATEGORY_NAME[issue.category]}
      </div>
      <div className="mb-1.5 font-bold text-[#182430]">&ldquo;{truncateForDisplay(issue.snippet, 110)}&rdquo;</div>
      <div className="mb-2.5 font-medium text-[#5C6773]">{issue.explanation}</div>

      {structural ? (
        <div className="mb-3 text-[11.5px] font-medium text-[#9AA4B0]">
          → <b className="font-bold text-[#182430]">아래에서 단계로 나누기</b>
        </div>
      ) : del ? (
        <div className="mb-3 text-[11.5px] font-medium text-[#9AA4B0]">
          → <span className="font-bold text-[#E5484D]">삭제</span>
        </div>
      ) : editable ? (
        <>
          <div className="mb-[7px] text-[11px] leading-[1.45] text-[#9AA4B0]">
            추천 문구가 채워져 있어요. 필요하면 고쳐서 적용하세요.
          </div>
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onApplyEdited(draft);
              }
            }}
            placeholder="직접 입력"
            className="mb-3 w-full rounded-lg border border-[#E4E8EE] bg-[#F5F7F9] px-[9px] py-[7px] text-[12.5px] text-[#182430] outline-none focus:border-[#00C9C8] focus:bg-white"
          />
        </>
      ) : (
        <div className="mb-3 text-[11.5px] font-medium text-[#9AA4B0]">
          → <b className="font-bold text-[#182430]">{truncateForDisplay(issue.replacement ?? "", 140)}</b>
        </div>
      )}

      <div className="flex gap-[7px]">
        {structural ? (
          <button
            onClick={onOpenMonoPanel}
            className="flex-1 rounded-lg bg-[#00C9C8] py-[7px] text-[12px] font-bold text-white hover:bg-[#0891B2]"
          >
            패널 열기
          </button>
        ) : (
          <button
            onClick={() => (editable ? onApplyEdited(draft) : onApply())}
            className="flex-1 rounded-lg bg-[#00C9C8] py-[7px] text-[12px] font-bold text-white hover:bg-[#0891B2]"
          >
            첨삭 반영
          </button>
        )}
        <button
          onClick={onSkip}
          className="flex-1 rounded-lg border border-[#E4E8EE] bg-white py-[7px] text-[12px] font-bold text-[#182430] hover:bg-[#F5F7F9]"
        >
          건너뛰기
        </button>
      </div>
    </span>
  );
}

// ── MONOLITHIC_REQUEST 분해 패널 (계획 미리보기 / 단계 토글) ───────────────────────
function MonoPanel({
  issue,
  onApply,
  onUndo,
  onToggleStep,
}: {
  issue: IssueState;
  onApply: () => void;
  onUndo: () => void;
  onToggleStep: (idx: number) => void;
}) {
  if (issue.status === "applied") {
    const steps: MonoStepState[] = issue.monoSteps ?? [];
    const onCount = steps.filter((s) => s.on).length;
    return (
      <div>
        <div className="mb-1 font-mono text-[12.5px] font-extrabold tracking-wide text-[#C9860A] uppercase">
          {steps.length}단계로 나눴어요
        </div>
        <p className="mb-3.5 text-[13.5px] font-semibold text-[#5C6773]">
          넣을 단계를 켜고 끄면 프롬프트가 바로 바뀌어요.
        </p>
        <div className="mb-3.5 flex flex-col gap-2">
          {steps.map((s, idx) => (
            <div
              key={idx}
              className={`flex items-center gap-3 rounded-[10px] border px-3 py-2.5 ${
                s.on ? "border-[#F0DBA0] bg-[#FFFBF0]" : "border-[#E4E8EE] bg-[#F5F7F9]"
              }`}
            >
              <span className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-md bg-[#FBF0D9] font-mono text-[12px] font-extrabold text-[#C9860A]">
                {idx + 1}
              </span>
              <span className="flex-1 text-[13px] font-semibold text-[#182430]">{s.title}</span>
              <button
                onClick={() => onToggleStep(idx)}
                className={`relative h-[19px] w-8 flex-none rounded-full transition-colors ${s.on ? "bg-[#00C9C8]" : "bg-[#D4D9E0]"}`}
              >
                <span
                  className={`absolute top-0.5 h-[15px] w-[15px] rounded-full bg-white transition-all ${s.on ? "left-[15px]" : "left-0.5"}`}
                />
              </button>
            </div>
          ))}
        </div>
        {onCount === 0 && <p className="mb-2.5 text-[11.5px] font-bold text-[#E5484D]">단계를 최소 1개는 켜 주세요.</p>}
        <button
          onClick={onUndo}
          className="w-full rounded-[9px] border border-[#E4E8EE] bg-white py-2 text-[12.5px] font-bold text-[#182430] hover:bg-[#F5F7F9]"
        >
          되돌리기
        </button>
      </div>
    );
  }

  const steps = issue.steps ?? [];
  return (
    <div>
      <div className="mb-1 font-mono text-[12.5px] font-extrabold tracking-wide text-[#C9860A] uppercase">
        {CATEGORY_NAME[issue.category]}
      </div>
      <p className="mb-3.5 text-[13.5px] font-semibold text-[#5C6773]">{issue.explanation}</p>
      <div className="mb-3.5 flex flex-col gap-2">
        {steps.map((s, idx) => (
          <div key={idx} className="flex items-start gap-3 rounded-[10px] border border-[#E4E8EE] bg-[#F5F7F9] px-3 py-2.5">
            <span className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-md bg-[#FBF0D9] font-mono text-[12px] font-extrabold text-[#C9860A]">
              {idx + 1}
            </span>
            <span className="text-[13px] leading-[1.5] font-semibold text-[#182430]">
              <b className="font-extrabold">{s.title}</b> — {s.desc}
            </span>
          </div>
        ))}
      </div>
      <button
        onClick={onApply}
        className="w-full rounded-[9px] bg-[#00C9C8] py-2 text-[12.5px] font-bold text-white hover:bg-[#0891B2]"
      >
        이 순서로 나누기
      </button>
    </div>
  );
}

// ── 누락 조건 목록 ───────────────────────
function MissingList({
  missing,
  expanded,
  onToggleExpand,
  onToggle,
  onEditPhrase,
  onPickOption,
  feedback,
}: {
  missing: MissingConstraintState[];
  expanded: boolean;
  onToggleExpand: () => void;
  onToggle: (id: string) => void;
  onEditPhrase: (id: string, value: string) => void;
  onPickOption: (id: string, oi: number) => void;
  feedback: string | null;
}) {
  if (!missing.length) {
    return <p className="text-[12.5px] font-semibold text-[#9AA4B0]">{feedback || "빠진 조건이 없어요."}</p>;
  }
  const highRec = missing.filter((m) => m.confidence !== "low");
  const low = missing.filter((m) => m.confidence === "low");
  const anyLowOn = low.some((m) => m.on);
  const showLow = expanded || anyLowOn;

  return (
    <div className="flex flex-col gap-2">
      {highRec.map((m) => (
        <MissRow key={m.id} m={m} onToggle={onToggle} onEditPhrase={onEditPhrase} onPickOption={onPickOption} />
      ))}
      {low.length > 0 && (
        <button
          onClick={onToggleExpand}
          className="py-1.5 text-left text-[11.5px] font-bold text-[#9AA4B0] hover:text-[#0891B2]"
        >
          {showLow ? "선택 조건 접기 ▴" : "다른 조건 추가 ▾"}
        </button>
      )}
      {showLow && low.map((m) => <MissRow key={m.id} m={m} onToggle={onToggle} onEditPhrase={onEditPhrase} onPickOption={onPickOption} />)}
    </div>
  );
}

function MissRow({
  m,
  onToggle,
  onEditPhrase,
  onPickOption,
}: {
  m: MissingConstraintState;
  onToggle: (id: string) => void;
  onEditPhrase: (id: string, value: string) => void;
  onPickOption: (id: string, oi: number) => void;
}) {
  const badgeTxt = m.confidence === "high" ? "감지" : m.confidence === "rec" ? "추천" : "선택";
  const badgeColor =
    m.confidence === "high"
      ? "bg-[#DFF3EA] text-[#0B8564]"
      : m.confidence === "rec"
        ? "bg-[#F0EEFA] text-[#5E4FB8]"
        : "bg-[#F5F7F9] text-[#9AA4B0]";

  return (
    <div
      className={`rounded-[10px] border px-3 py-2.5 transition-colors ${
        m.on ? "border-[#BFE7D8] bg-[#E3F6EE]" : "border-[#E4E8EE] bg-white"
      }`}
    >
      {m.confidence === "low" ? (
        <>
          <div className="flex items-center gap-2">
            <span className="text-[12.5px] font-extrabold text-[#182430]">{m.field}</span>
            <span className={`rounded px-1.5 py-0.5 font-mono text-[9px] font-extrabold tracking-wide uppercase ${badgeColor}`}>
              {badgeTxt}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(m.options ?? []).map((o, oi) => (
              <button
                key={oi}
                onClick={() => onPickOption(m.id, oi)}
                className={`rounded-[7px] border px-2.5 py-1 text-[11.5px] font-semibold transition-colors ${
                  m.selectedOption === oi
                    ? "border-[#00C9C8] bg-[#00C9C8] text-white"
                    : "border-[#E4E8EE] bg-white text-[#5C6773] hover:border-[#00C9C8]"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="flex items-center gap-2.5">
          <span className="flex-none text-[12.5px] font-extrabold whitespace-nowrap text-[#182430]">{m.field}</span>
          <span className={`flex-none rounded px-1.5 py-0.5 font-mono text-[9px] font-extrabold tracking-wide uppercase ${badgeColor}`}>
            {badgeTxt}
          </span>
          <div className="relative flex-1">
            <input
              value={m.phrase ?? ""}
              placeholder="문장을 직접 입력"
              onChange={(e) => onEditPhrase(m.id, e.target.value)}
              className="w-full rounded-[7px] border border-[#E4E8EE] bg-white px-2.5 py-1.5 pr-7 text-[12.5px] text-[#182430] outline-none focus:border-[#00C9C8]"
            />
            {m.phrase && (
              <button
                onClick={() => onEditPhrase(m.id, "")}
                title="지우기"
                className="absolute top-1/2 right-1.5 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-[#9AA4B0] hover:bg-[#F5F7F9] hover:text-[#E5484D]"
              >
                ×
              </button>
            )}
          </div>
          <button
            onClick={() => onToggle(m.id)}
            className={`relative h-[19px] w-8 flex-none rounded-full transition-colors ${m.on ? "bg-[#00C9C8]" : "bg-[#D4D9E0]"}`}
          >
            <span
              className={`absolute top-0.5 h-[15px] w-[15px] rounded-full bg-white transition-all ${m.on ? "left-[15px]" : "left-0.5"}`}
            />
          </button>
        </div>
      )}
    </div>
  );
}

// ── 완료 화면 ───────────────────────
function DiagnosisComplete({
  finalText,
  beforeTok,
  afterTok,
  totalIssues,
  resolved,
}: {
  finalText: string;
  beforeTok: number;
  afterTok: number;
  totalIssues: number;
  resolved: number;
}) {
  const [copied, setCopied] = useState(false);
  const pct = beforeTok ? Math.max(0, Math.round((1 - afterTok / beforeTok) * 100)) : 0;
  const iter = iterationEstimate(totalIssues, resolved);
  const maxCost = Math.max(...MODEL_PRICING.map((m) => estimateCost(beforeTok, m)));

  function copy() {
    navigator.clipboard
      ?.writeText(finalText)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {});
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-[#E4E8EE] bg-white">
        <div className="flex items-center justify-between gap-2.5 border-b border-[#EEF1F4] px-5 py-3.5">
          <h2 className="text-[12.5px] font-extrabold tracking-[.01em] text-[#5C6773]">최적화된 프롬프트</h2>
          <button onClick={copy} className="font-mono text-[11.5px] font-bold text-[#0891B2] hover:underline">
            {copied ? "복사됨!" : "복사해서 쓰세요"}
          </button>
        </div>
        <div className="m-5 rounded-xl border border-[#BFE7D8] bg-[#E3F6EE] px-[18px] py-4 text-[15px] leading-[1.9] whitespace-pre-wrap text-[#182430]">
          {finalText}
        </div>
      </div>

      <div className="rounded-xl border border-[#E4E8EE] bg-white p-5">
        <h3 className="mb-3 text-[12.5px] font-extrabold tracking-wide text-[#5C6773]">토큰 절감 내역</h3>
        <LedgerRow k="최적화 전" v={String(beforeTok)} />
        <LedgerRow k="최적화 후" v={String(afterTok)} highlight />
        <LedgerRow k="절감률" v={`${pct}%`} highlight big />
        <LedgerRow k="예상 연쇄 수정" v={`${iter.before}회 → ${iter.after}회`} highlight />
      </div>

      <div className="rounded-xl border border-[#E4E8EE] bg-white p-5">
        <h3 className="mb-0.5 text-[12.5px] font-extrabold tracking-wide text-[#5C6773]">모델별 비용 비교</h3>
        <div className="mb-3 font-mono text-[10.5px] font-bold text-[#9AA4B0]">
          최적화 후 예상 · {MODEL_PRICING.length}개 모델
        </div>
        <div className="flex flex-col gap-2">
          {MODEL_PRICING.map((m, idx) => {
            const before = estimateCost(beforeTok, m);
            const after = estimateCost(afterTok, m);
            const wBefore = Math.max(4, (before / maxCost) * 100);
            const wAfter = Math.max(3, (after / maxCost) * 100);
            return (
              <div key={m.key} className="flex items-center gap-2.5">
                <span className="w-[62px] flex-none text-[11px] font-extrabold text-[#182430]">
                  {m.name}
                  {idx === 0 && <span className="ml-0.5 text-[#E5484D]">★</span>}
                </span>
                <div className="relative h-4 flex-1 overflow-hidden rounded-md bg-[#F5F7F9]">
                  <div className="absolute inset-y-0 left-0 rounded-l-md bg-[#9AA4B0] opacity-35" style={{ width: `${wBefore}%` }} />
                  <div className="absolute inset-y-0 left-0 rounded-md bg-[#00C9C8] opacity-90" style={{ width: `${wAfter}%` }} />
                </div>
                <span className="w-[58px] flex-none text-right font-mono text-[10.5px] font-semibold text-[#5C6773]">
                  ${after.toFixed(4)}
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-2.5 flex gap-3.5 text-[10.5px] font-bold text-[#9AA4B0]">
          <span className="inline-flex items-center gap-1">
            <i className="inline-block h-[9px] w-[9px] rounded-[3px] bg-[#9AA4B0] opacity-35" />
            최적화 전
          </span>
          <span className="inline-flex items-center gap-1">
            <i className="inline-block h-[9px] w-[9px] rounded-[3px] bg-[#00C9C8]" />
            최적화 후
          </span>
        </div>
      </div>
    </div>
  );
}

function LedgerRow({ k, v, highlight, big }: { k: string; v: string; highlight?: boolean; big?: boolean }) {
  return (
    <div className="flex items-baseline justify-between border-t border-[#EEF1F4] py-2 first:border-t-0">
      <span className="text-[12px] font-semibold text-[#5C6773]">{k}</span>
      <span
        className={`font-mono font-extrabold ${big ? "text-[22px]" : "text-[14px]"} ${highlight ? "text-[#0891B2]" : "text-[#182430]"}`}
      >
        {v}
      </span>
    </div>
  );
}
