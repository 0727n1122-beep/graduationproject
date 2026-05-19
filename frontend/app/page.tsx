"use client";

import { useState } from "react";
import PromptInput from "../src/components/PromptInput";

export default function Home() {
  const [result, setResult] = useState(null);

  const handleOptimize = async (prompt: string) => {
    console.log("입력된 프롬프트:", prompt);
    // 나중에 백엔드 API 연결할 곳
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-blue-50 to-white py-12">
      <div className="container mx-auto px-4">
        <h1 className="text-5xl font-bold text-center mb-4 text-gray-900">
          AI Tasker
        </h1>
        <p className="text-center text-gray-600 mb-12">
          프롬프트 최적화로 토큰 비용 절약하기
        </p>

        <PromptInput onOptimize={handleOptimize} />
      </div>
    </main>
  );
}
