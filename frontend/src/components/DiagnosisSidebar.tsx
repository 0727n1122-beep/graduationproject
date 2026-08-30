"use client";

// ============================================================
// DiagnosisSidebar.tsx — 앱 좌측 레일 네비게이션.
// docs/minifi-diagnosis-mockup-v4_1.html의 .rail을 그대로 이식 (아쿠아블루 테마).
// 첨삭/히스토리/마이페이지 페이지가 아직 없어서 현재는 diagnosis만 활성 링크로 동작.
// ============================================================

import type { ReactNode } from "react";
import Link from "next/link";

export type SidebarView = "diagnosis" | "history" | "mypage";

interface NavItem {
  view: SidebarView;
  label: string;
  icon: ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  {
    view: "diagnosis",
    label: "첨삭하기",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 19l4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 19Z" />
      </svg>
    ),
  },
  {
    view: "history",
    label: "히스토리",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="8.2" />
        <path d="M12 7.5V12l3 2" />
      </svg>
    ),
  },
  {
    view: "mypage",
    label: "마이페이지",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="8.5" r="3.4" />
        <path d="M4.8 19.5c1.4-3.4 4-5 7.2-5s5.8 1.6 7.2 5" />
      </svg>
    ),
  },
];

export default function DiagnosisSidebar({
  active,
  onNavigate,
}: {
  active: SidebarView;
  /** 아직 없는 페이지로 이동을 시도할 때 호출됨 (히스토리/마이페이지 미구현) */
  onNavigate?: (view: SidebarView) => void;
}) {
  return (
    <aside className="flex w-[76px] flex-none flex-col items-center gap-[22px] bg-[#182430] py-5">
      <Link
        href="/"
        title="Minifi 소개"
        className="flex h-[38px] w-[38px] items-center justify-center rounded-[10px] bg-[#00C9C8] text-[16px] font-extrabold text-white transition-transform hover:scale-[1.06]"
      >
        M
      </Link>
      <nav className="mt-1.5 flex flex-col gap-1.5">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.view}
            title={item.label}
            onClick={() => onNavigate?.(item.view)}
            className={[
              "flex h-11 w-11 items-center justify-center rounded-[10px] transition-colors",
              "[&_svg]:h-[19px] [&_svg]:w-[19px]",
              active === item.view
                ? "bg-[#232D3A] text-white shadow-[inset_2px_0_0_#00C9C8]"
                : "text-[#8892A3] hover:bg-[#232D3A] hover:text-white",
            ].join(" ")}
          >
            {item.icon}
          </button>
        ))}
      </nav>
      <div className="flex-1" />
    </aside>
  );
}
