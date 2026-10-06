"use client";

import DiagnosisSidebar from "@/src/components/DiagnosisSidebar";
import MyPage from "@/src/components/MyPage";

export default function MyPageRoute() {
  return (
    <div className="flex min-h-screen bg-[#F5F7F9]">
      <DiagnosisSidebar active="mypage" />
      <main className="flex-1 p-9">
        <div className="max-w-[720px]">
          <MyPage />
        </div>
      </main>
    </div>
  );
}
