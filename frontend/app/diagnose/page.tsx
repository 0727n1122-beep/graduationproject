"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DiagnosisCards from "@/src/components/DiagnosisCards";
import DiagnosisSidebar from "@/src/components/DiagnosisSidebar";
import PromptEntry from "@/src/components/PromptEntry";
import type { OptimizeResponse } from "@/types/diagnosis";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const REPLAY_KEY = "minifi_replay_prompt";

export default function DiagnosePage() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [submittedPrompt, setSubmittedPrompt] = useState("");
  const [result, setResult] = useState<OptimizeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 히스토리 화면의 "다시 진단하기"로 넘어온 경우 원본 프롬프트를 입력창에 채워줌
    const replay = sessionStorage.getItem(REPLAY_KEY);
    if (replay) {
      sessionStorage.removeItem(REPLAY_KEY);
      setPrompt(replay);
    }
  }, []);

  async function handleSubmit() {
    if (!prompt.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(`${API_URL}/optimize`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error ?? "진단에 실패했어요. 다시 시도해주세요.");
        return;
      }
      setSubmittedPrompt(prompt);
      setResult(data as OptimizeResponse);
    } catch {
      setError("서버에 연결할 수 없어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-[#F5F7F9]">
      <DiagnosisSidebar
        active="diagnosis"
        onNavigate={(view) => {
          if (view === "diagnosis") setResult(null); // 첨삭 아이콘 다시 클릭 → 새 프롬프트 입력으로
          if (view === "mypage") router.push("/mypage");
        }}
      />
      <main className="flex-1 p-9">
        <div className="max-w-[1240px]">
          {result ? (
            // key로 프롬프트마다 DiagnosisCards 내부 상태(적용/건너뛰기 등)를 새로 초기화
            <DiagnosisCards key={submittedPrompt} prompt={submittedPrompt} result={result} />
          ) : (
            <PromptEntry prompt={prompt} onChange={setPrompt} onSubmit={handleSubmit} loading={loading} error={error} />
          )}
        </div>
      </main>
    </div>
  );
}
