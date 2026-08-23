"use client";

// ============================================================
// DiagnosisCards.tsx — 구조 정리본 (Week 1)
// ------------------------------------------------------------
// 목업(minifi-diagnosis-mockup) 기준으로 데이터 모델을 교체.
// 기존의 issues[]/improvements[] 좌우 나열 구조는 폐기.
// 새 구조 = 프롬프트 본문을 세그먼트로 렌더링 + 문제 구간에 span 밑줄.
//
// ⚠ Week 1 범위: 골격 + 타입 연결 + 렌더링 자리만.
//    팝오버 / 적용·치환 / 토큰·등급 계산은 Week 2 실구현 (아래 TODO).
// ============================================================

import { useState } from "react";
import type {
  DiagnosisResult,
  IssueSegmentState,
  CategoryMap,
} from "@/types/diagnosis";

// 카테고리 표시용 메타 (목업 CAT 이식)
// Week 2 팝오버에서 CAT[issue.cat].name 으로 사용 예정.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const CAT: CategoryMap = {
  filler: { name: "불필요한 군더더기" },
  redundant: { name: "중복 표현" },
  ambiguous: { name: "모호한 지시" },
  monolithic: { name: "한 번에 너무 많음" },
};

interface DiagnosisCardsProps {
  /** /optimize 응답 한 건 */
  result: DiagnosisResult;
}

export default function DiagnosisCards({ result }: DiagnosisCardsProps) {
  // 밑줄 클릭 시 열리는 팝오버의 대상 인덱스 (Week 2에서 사용)
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <div className="mx-auto mt-12 max-w-4xl">
      {/* ── 프롬프트 본문 (세그먼트 렌더링) ────────────── */}
      <div className="rounded-xl border border-[#A5E8E7] bg-white p-6 leading-[2.15] text-[17px]">
        {result.segments.map((seg, i) =>
          seg.t === "text" ? (
            // 일반 텍스트: 그대로 출력
            <span key={i}>{seg.text}</span>
          ) : (
            // 이슈 구간: span에 밑줄 + 클릭 (span 직접 구현 방식)
            <IssueMark
              key={i}
              issue={seg as IssueSegmentState}
              open={openIdx === i}
              onOpen={() => setOpenIdx(openIdx === i ? null : i)}
            />
          ),
        )}
      </div>

      {/* TODO(Week2): 팝오버 — 밑줄 클릭 시 why/repl 표시, 적용·건너뛰기 버튼 */}
      {/* TODO(Week2): monolithic 분해 아코디언 (seg.steps 렌더링) */}
      {/* TODO(Week2): missing 조건 추가 UI (result.miss 렌더링) */}
      {/* TODO(Week2): 토큰·등급 실시간 계산 (baseToken / tok 합산 → gradeFor) */}
    </div>
  );
}

// ── 문제 구간 하나 = 밑줄 span ───────────────────────────
// Week 1: 카테고리별 밑줄 색만. 클릭하면 open 토글까지.
// Week 2: 여기 팝오버 붙이고 applied/skipped 상태별 스타일 추가.
function IssueMark({
  issue,
  open,
  onOpen,
}: {
  issue: IssueSegmentState;
  open: boolean;
  onOpen: () => void;
}) {
  // 카테고리별 밑줄 색 (목업 --c-* 대응)
  const underline: Record<string, string> = {
    filler: "decoration-[#E5484D]",
    redundant: "decoration-[#E5484D]",
    ambiguous: "decoration-[#E5484D]",
    monolithic: "decoration-[#C9860A]",
  };

  return (
    <span
      role="button"
      tabIndex={0}
      onClick={onOpen}
      className={[
        "cursor-pointer rounded-[3px] px-[2px]",
        "underline decoration-wavy decoration-2 underline-offset-4",
        underline[issue.cat] ?? "",
        open ? "bg-[#E0F7F7]" : "",
      ].join(" ")}
    >
      {issue.text}
      {/* TODO(Week2): {open && <DiagnosisPopover issue={issue} category={CAT[issue.cat]} .../>} */}
    </span>
  );
}
