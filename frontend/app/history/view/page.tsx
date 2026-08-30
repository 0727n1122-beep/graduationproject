"use client";

// ============================================================
// /history/view — 히스토리 "기록 보기" 화면.
// ------------------------------------------------------------
// HistoryView.tsx의 "기록 보기" 버튼이 sessionStorage에 담아둔, 그때 저장된
// 진단 결과(issues/missing_constraints/feedback)를 그대로 DiagnosisCards에
// 넘겨서 재현한다. /optimize를 다시 호출하지 않으므로 API 비용도 없고, 그때
// 실제로 봤던 결과와 완전히 동일하다(모델이 매번 다른 진단을 낼 수 있어
// 재호출로는 재현이 안 됨).
// ============================================================

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import DiagnosisCards from "@/src/components/DiagnosisCards";
import DiagnosisSidebar from "@/src/components/DiagnosisSidebar";
import type { OptimizeResponse } from "@/types/diagnosis";

const VIEW_KEY = "minifi_history_view";

interface ViewPayload {
  prompt: string;
  result: OptimizeResponse;
}

export default function HistoryViewPage() {
  const router = useRouter();
  const [payload, setPayload] = useState<ViewPayload | null | undefined>(undefined);
  // sessionStorage는 한 번 읽으면 지우는 일회성 소비라, StrictMode 개발 모드가
  // effect를 두 번 실행하면 두 번째 실행에서 이미 지워진 값을 읽어 항상 실패함 —
  // ref로 실제 소비는 최초 1회만 일어나도록 막음(state는 StrictMode의 재실행
  // 사이에도 유지되므로 이 가드가 유효함).
  const consumed = useRef(false);

  useEffect(() => {
    if (consumed.current) return;
    consumed.current = true;

    const raw = sessionStorage.getItem(VIEW_KEY);
    sessionStorage.removeItem(VIEW_KEY);
    if (!raw) {
      setPayload(null);
      return;
    }
    try {
      setPayload(JSON.parse(raw) as ViewPayload);
    } catch {
      setPayload(null);
    }
  }, []);

  return (
    <div className="flex min-h-screen bg-[#F5F7F9]">
      <DiagnosisSidebar
        active="history"
        onNavigate={(view) => {
          if (view === "diagnosis") router.push("/diagnose");
          if (view === "mypage") router.push("/mypage");
        }}
      />
      <main className="flex-1 p-9">
        <div className="max-w-[1240px]">
          {payload === undefined ? null : payload === null ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-[#E4E8EE] bg-white px-6 py-16 text-center">
              <p className="text-[14px] font-semibold text-[#5C6773]">
                기록을 불러올 수 없어요. 히스토리 목록에서 다시 열어주세요.
              </p>
              <Link
                href="/history"
                className="h-[38px] rounded-[9px] bg-[#00C9C8] px-5 text-[13px] font-bold leading-[38px] text-white transition-colors hover:bg-[#0891B2]"
              >
                히스토리로 돌아가기
              </Link>
            </div>
          ) : (
            <DiagnosisCards
              prompt={payload.prompt}
              result={payload.result}
              eyebrow="히스토리 · 기록 보기"
              subtitle="그때 반영했던 첨삭 기록이에요"
            />
          )}
        </div>
      </main>
    </div>
  );
}
