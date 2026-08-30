"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import DiagnosisSidebar from "@/src/components/DiagnosisSidebar";
import HistoryView from "@/src/components/HistoryView";
import type { HistoryItem } from "@/types/history";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function HistoryPage() {
  const [items, setItems] = useState<HistoryItem[] | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      setNeedsLogin(true);
      return;
    }
    (async () => {
      try {
        const res = await fetch(`${API_URL}/history`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401) {
          setNeedsLogin(true);
          return;
        }
        if (!res.ok) {
          setError("히스토리를 불러오지 못했어요. 잠시 후 다시 시도해주세요.");
          return;
        }
        setItems((await res.json()) as HistoryItem[]);
      } catch {
        setError("서버에 연결할 수 없어요. 잠시 후 다시 시도해주세요.");
      }
    })();
  }, []);

  return (
    <div className="flex min-h-screen bg-[#F5F7F9]">
      <DiagnosisSidebar active="history" />
      <main className="flex-1 p-9">
        <div className="max-w-[1240px]">
          {needsLogin ? (
            <LoginRequired />
          ) : error ? (
            <ErrorBox message={error} />
          ) : items === null ? (
            <p className="text-[13px] font-semibold text-[#9AA4B0]">불러오는 중…</p>
          ) : (
            <HistoryView items={items} />
          )}
        </div>
      </main>
    </div>
  );
}

function LoginRequired() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-[#E4E8EE] bg-white px-6 py-16 text-center">
      <p className="text-[14px] font-semibold text-[#5C6773]">히스토리를 보려면 로그인이 필요해요.</p>
      <Link
        href="/auth"
        className="h-[38px] rounded-[9px] bg-[#00C9C8] px-5 text-[13px] font-bold leading-[38px] text-white transition-colors hover:bg-[#0891B2]"
      >
        로그인하러 가기
      </Link>
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <p className="rounded-lg border border-[#F5C2C4] bg-[#FDECEC] px-3.5 py-2.5 text-[12.5px] font-semibold text-[#E5484D]">
      {message}
    </p>
  );
}
