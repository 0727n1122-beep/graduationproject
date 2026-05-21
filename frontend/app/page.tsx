"use client";

import { useState } from "react";
import PromptInput from "@/src/components/PromptInput";
import BeforeAfter from "@/src/components/BeforeAfter";
import StatsCards from "@/src/components/StatsCards";

// 명확한 타입 정의
// result 변수는 해당 4가지 항목만 들어가고, 각각 타입이 도와준다
interface OptimizeResult {
  original: string;
  optimized: string;
  tokensBefore: number;
  tokensAfter: number;
  scoreBefore: number;
  scoreAfter: number;
}

export default function Home() {
  const [result, setResult] = useState<OptimizeResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleOptimize = async (prompt: string) => {
    setLoading(true);

    // Mock 데이터 (임시)
    setTimeout(() => {
      const optimized = prompt
        .replace(/좀|혹시|아|일단|그냥|걍|근데|ㅇㅇ/g, "")
        .replace(/\s+/g, " ")
        .trim();

      const tokensBefore = Math.ceil(prompt.length * 2.5);
      const tokensAfter = Math.ceil(optimized.length * 2.5);

      setResult({
        original: prompt,
        optimized: optimized || prompt,
        tokensBefore,
        tokensAfter,
        scoreBefore: 45,
        scoreAfter: 82,
        // 백엔드 api 연결 후 실제 점수로 대체 예정
      });
      setLoading(false);
    }, 1500);
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-600 py-12">
      <div className="container mx-auto px-4">
        <h1 className="text-5xl font-bold text-center mb-4 text-blue-900">
          AI Tasker
        </h1>
        <p className="text-center text-white mb-12">
          프롬프트 최적화로 토큰 비용 절약하기
        </p>

        <PromptInput onOptimize={handleOptimize} />

        {loading && (
          <div className="text-center mt-8">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="text-lg text-white mt-4">최적화 중...</p>
          </div>
        )}

        {result && !loading && (
          <BeforeAfter
            original={result.original}
            optimized={result.optimized}
            tokensBefore={result.tokensBefore}
            tokensAfter={result.tokensAfter}
          />
        )}
        {result && !loading && (
          <StatsCards
            tokensBefore={result.tokensBefore}
            tokensAfter={result.tokensAfter}
            scoreBefore={result.scoreBefore}
            scoreAfter={result.scoreAfter}
          />
        )}
      </div>
    </main>
  );
}
