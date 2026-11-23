"use client";

// ============================================================
// HistoryView.tsx — 첨삭 히스토리 화면
// ------------------------------------------------------------
// docs/minifi-diagnosis-mockup-v4_1.html의 히스토리 뷰(#view-history)를
// 실제 배포 화면으로 이식. 목업과 다른 점:
//   - 목업은 히스토리 목록 → 통계 카드 → 분포 차트 순이었지만,
//     여기서는 통계 카드 + 분포 차트를 위로, 히스토리 목록을 아래로 배치.
//   - 히스토리 목록은 최근 10건만 표시 (백엔드가 이미 최신순으로 내려줌).
//   - 통계 카드는 목업의 4종(진단 수/이슈 수/카테고리 종류/최다 발견 유형)에서
//     "카테고리 종류"를 "누적 절감 토큰"으로 바꾸고, "예상 절감 재질문"을
//     추가해 총 5개. "이슈 유형 분포" 차트에 카테고리 개수/분포가 이미 나오므로
//     카드에서는 중복 대신 절감 토큰을 보여줌.
//   - "최근 절감률 추이" 차트는 시계열 데이터가 없어 목업도 그룹별 분포로
//     대체했던 부분이라 이식하지 않음.
// 아쿠아블루(#00C9C8/#0891B2) 테마 — DiagnosisCards.tsx와 동일한 팔레트.
// ============================================================

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { HistoryItem } from "@/types/history";
import { CATEGORY_NAME, type IssueCategory } from "@/types/diagnosis";
import { truncateForDisplay } from "@/src/lib/diagnosisEngine";

const VIEW_KEY = "minifi_history_view";
const RECENT_LIMIT = 10;

function categoryLabel(cat: string): string {
  return CATEGORY_NAME[cat as IssueCategory] ?? cat;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function HistoryView({
  items,
  onDelete,
}: {
  items: HistoryItem[];
  /** 성공하면 null, 실패하면 에러 메시지를 돌려준다. 성공 시 items에서 해당 항목이
   *  바로 빠지도록(재조회 없이) 호출부(app/history/page.tsx)가 로컬 상태를 갱신한다. */
  onDelete: (id: number) => Promise<string | null>;
}) {
  const router = useRouter();
  const recent = items.slice(0, RECENT_LIMIT);

  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<{ id: number; message: string } | null>(null);

  async function confirmDelete() {
    if (confirmingId === null) return;
    const id = confirmingId;
    setDeletingId(id);
    setDeleteError(null);
    const message = await onDelete(id);
    setDeletingId(null);
    setConfirmingId(null);
    if (message) setDeleteError({ id, message });
  }

  const count = items.length;
  const totalIssues = items.reduce((sum, it) => sum + it.issue_count, 0);
  // DiagnosisCards.tsx의 절감률 표시와 동일하게, 구조화하면서 토큰이 오히려 늘어난 경우
  // (예: MONOLITHIC_REQUEST 분해)는 "절감"이 아니므로 0으로 바닥 처리해서 합산.
  const totalSavedTokens = items.reduce((sum, it) => sum + Math.max(0, it.saved_tokens), 0);
  // DiagnosisCards.tsx/diagnosisEngine.ts의 iterationEstimate와 같은 공식(이슈 수×1.4+1)을
  // 히스토리 저장 시점의 issue_count로 계산 — 별도 스키마 변경 없이 바로 구할 수 있음.
  // 백엔드가 저장하는 optimized_prompt는 이슈를 전부 반영한 버전이라 "이대로 다 적용했다면"
  // 기준으로 재질문 0회를 가정하고, 이슈가 없던 프롬프트(0건)는 절감할 게 없으니 0으로 둠.
  const totalIterationsSaved = items.reduce(
    (sum, it) => sum + (it.issue_count > 0 ? Math.max(1, Math.round(it.issue_count * 1.4) + 1) : 0),
    0,
  );

  const categoryTally: Record<string, number> = {};
  items.forEach((it) => {
    if (!it.categories) return; // categories 컬럼 추가 이전에 저장된 항목
    for (const [cat, n] of Object.entries(it.categories)) {
      categoryTally[cat] = (categoryTally[cat] || 0) + n;
    }
  });
  const categoryEntries = Object.entries(categoryTally).sort((a, b) => b[1] - a[1]);
  const topCategory = categoryEntries[0];
  const maxCategoryCount = Math.max(1, ...categoryEntries.map(([, n]) => n));

  function viewRecord(item: HistoryItem) {
    if (!item.diagnosis_detail) return;
    const payload = {
      prompt: item.original_prompt,
      result: {
        original_tokens: item.original_tokens,
        optimized_tokens: item.optimized_tokens,
        saved_tokens: item.saved_tokens,
        saved_percent: item.saved_percent,
        optimized_prompt: item.optimized_prompt,
        issues: item.diagnosis_detail.issues,
        missing_constraints: item.diagnosis_detail.missing_constraints,
        feedback: item.diagnosis_detail.feedback,
        costs: {},
      },
    };
    sessionStorage.setItem(VIEW_KEY, JSON.stringify(payload));
    router.push("/history/view");
  }

  return (
    <div className="flex flex-col gap-[22px]">
      <div>
        <div className="mb-1.5 font-mono text-[11px] font-extrabold tracking-[.08em] text-[#0891B2] uppercase">
          히스토리
        </div>
        <h1 className="text-[26px] font-extrabold tracking-tight text-[#182430]">첨삭 히스토리</h1>
        <div className="mt-1 text-[12.5px] font-semibold text-[#9AA4B0]">
          그때 반영했던 첨삭 기록을 다시 볼 수 있어요
        </div>
      </div>

      {count === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-[#E4E8EE] bg-white px-6 py-14 text-center">
          <p className="text-[14px] font-semibold text-[#5C6773]">아직 첨삭한 프롬프트가 없어요.</p>
          <Link
            href="/diagnose"
            className="h-[38px] rounded-[9px] bg-[#00C9C8] px-5 text-[13px] font-bold leading-[38px] text-white transition-colors hover:bg-[#0891B2]"
          >
            첫 프롬프트 첨삭하러 가기
          </Link>
        </div>
      ) : (
        <>
          {/* ── 통계 카드 ────────────── */}
          <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-5">
            <StatCard label="진단한 프롬프트" value={String(count)} suffix="건" />
            <StatCard label="총 이슈 수" value={String(totalIssues)} suffix="건" />
            <StatCard label="누적 절감 토큰" value={totalSavedTokens.toLocaleString()} suffix="토큰" />
            <StatCard
              label="최다 발견 유형"
              value={topCategory ? categoryLabel(topCategory[0]) : "-"}
              suffix={topCategory ? `${topCategory[1]}건` : ""}
            />
            <StatCard label="예상 절감 재질문" value={String(totalIterationsSaved)} suffix="회" />
          </div>

          {/* ── 이슈 유형 분포 ────────────── */}
          {categoryEntries.length > 0 && (
            <div className="rounded-xl border border-[#E4E8EE] bg-white">
              <div className="flex items-center justify-between gap-2.5 border-b border-[#EEF1F4] px-5 py-3.5">
                <h2 className="text-[12.5px] font-extrabold tracking-[.01em] text-[#5C6773]">이슈 유형 분포</h2>
                <span className="font-mono text-[11.5px] font-bold text-[#9AA4B0]">CATEGORY</span>
              </div>
              <div className="flex flex-col gap-2.5 p-5">
                {categoryEntries.map(([cat, n]) => (
                  <div key={cat} className="flex items-center gap-2.5">
                    <span className="w-[112px] flex-none text-[11.5px] font-bold text-[#182430]">{categoryLabel(cat)}</span>
                    <div className="relative h-4 flex-1 overflow-hidden rounded-md bg-[#F5F7F9]">
                      <div
                        className="absolute inset-y-0 left-0 rounded-md bg-[#00C9C8] opacity-90"
                        style={{ width: `${Math.max(4, (n / maxCategoryCount) * 100)}%` }}
                      />
                    </div>
                    <span className="w-[28px] flex-none text-right font-mono text-[11px] font-bold text-[#5C6773]">{n}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── 히스토리 목록 (최근 10건) ────────────── */}
          <div className="rounded-xl border border-[#E4E8EE] bg-white">
            <div className="flex items-center justify-between gap-2.5 border-b border-[#EEF1F4] px-5 py-3.5">
              <h2 className="text-[12.5px] font-extrabold tracking-[.01em] text-[#5C6773]">최근 첨삭 기록</h2>
              <span className="font-mono text-[11.5px] font-bold text-[#9AA4B0]">
                {recent.length} / {count}
              </span>
            </div>
            <div className="flex flex-col gap-2.5 p-5">
              {recent.map((item) => (
                <div key={item.id}>
                  <div className="flex flex-wrap items-center gap-4 rounded-[10px] border border-[#E4E8EE] bg-[#F5F7F9] px-4 py-3">
                    <div className="min-w-[220px] flex-1">
                      <div className="mb-0.5 font-mono text-[10.5px] font-bold text-[#9AA4B0]">
                        {formatDate(item.created_at)}
                      </div>
                      <div className="text-[13.5px] leading-[1.5] text-[#182430]">
                        {truncateForDisplay(item.original_prompt.replace(/\s+/g, " "), 72)}
                      </div>
                    </div>
                    <div className="flex flex-none items-center gap-2 font-mono text-[11px] font-bold text-[#5C6773]">
                      <span className="rounded bg-[#FBF0D9] px-1.5 py-0.5 text-[#C9860A]">이슈 {item.issue_count}</span>
                      <span className="rounded bg-[#E3F6EE] px-1.5 py-0.5 text-[#0B8564]">
                        -{Math.max(0, item.saved_percent)}% · {Math.max(0, item.saved_tokens)}토큰
                      </span>
                    </div>
                    <button
                      onClick={() => viewRecord(item)}
                      disabled={!item.diagnosis_detail}
                      title={item.diagnosis_detail ? undefined : "예전 기록이라 상세 내역이 없어요"}
                      className="h-8 flex-none rounded-lg border border-[#00C9C8] px-3.5 text-[12px] font-bold text-[#0891B2] transition-colors hover:bg-[#E0F7F7] disabled:cursor-not-allowed disabled:border-[#E4E8EE] disabled:text-[#9AA4B0] disabled:hover:bg-transparent"
                    >
                      기록 보기
                    </button>
                    <button
                      onClick={() => {
                        setDeleteError(null);
                        setConfirmingId(item.id);
                      }}
                      disabled={deletingId === item.id}
                      title="삭제"
                      aria-label="삭제"
                      className="flex h-8 w-8 flex-none items-center justify-center rounded-lg border border-[#E4E8EE] bg-white text-[#9AA4B0] transition-colors hover:border-[#E5484D] hover:text-[#E5484D] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                  {deleteError?.id === item.id && (
                    <p className="mt-1.5 px-1 text-[11.5px] font-semibold text-[#E5484D]">{deleteError.message}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {confirmingId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-6">
          <div className="w-full max-w-[360px] rounded-xl border border-[#E4E8EE] bg-white p-6">
            <h3 className="mb-2 text-[15px] font-extrabold text-[#182430]">이 기록을 삭제하시겠어요?</h3>
            <p className="mb-5 text-[12.5px] leading-[1.6] font-semibold text-[#9AA4B0]">
              삭제한 첨삭 기록은 다시 볼 수 없어요. 이 작업은 되돌릴 수 없어요.
            </p>
            <div className="flex gap-2">
              <button
                onClick={confirmDelete}
                disabled={deletingId !== null}
                className="h-[38px] flex-1 rounded-[9px] bg-[#E5484D] text-[12.5px] font-bold text-white hover:bg-[#C93D42] disabled:bg-[#D4D9E0]"
              >
                {deletingId !== null ? "처리 중…" : "삭제하기"}
              </button>
              <button
                onClick={() => setConfirmingId(null)}
                disabled={deletingId !== null}
                className="h-[38px] flex-1 rounded-[9px] border border-[#E4E8EE] bg-white text-[12.5px] font-bold text-[#182430] hover:bg-[#F5F7F9]"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M4 7h16M9 7V4h6v3M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function StatCard({ label, value, suffix }: { label: string; value: string; suffix: string }) {
  return (
    <div className="rounded-xl border border-[#E4E8EE] bg-white p-4">
      <div className="mb-2 text-[11px] font-extrabold tracking-[.02em] text-[#9AA4B0]">{label}</div>
      <div className="font-mono text-[22px] font-extrabold text-[#182430]">
        {value}
        <small className="ml-1 text-[12px] font-bold text-[#9AA4B0]">{suffix}</small>
      </div>
    </div>
  );
}
