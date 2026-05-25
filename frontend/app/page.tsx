"use client";

import { useState } from "react";
import Header from "@/src/components/Header";
import PromptInput from "@/src/components/PromptInput";
import OptimizedResult from "@/src/components/OptimizedResult";
import StatsCards from "@/src/components/StatsCards";

interface OptimizeResult {
  original: string;
  optimized: string;
  tokensBefore: number;
  tokensAfter: number;
  improvement: number;
}

export default function Home() {
  const [result, setResult] = useState<OptimizeResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleOptimize = async (prompt: string) => {
    setLoading(true);

    // Mock 데이터 (임시)
    setTimeout(() => {
      const optimized = prompt
        .replace(/좀|혹시|아|일단|그냥/g, "")
        .replace(/\s+/g, " ")
        .trim();

      const tokensBefore = Math.ceil(prompt.length * 2.5);
      const tokensAfter = Math.ceil(optimized.length * 2.5);
      const improvement = Math.round(
        ((tokensBefore - tokensAfter) / tokensBefore) * 100,
      );

      setResult({
        original: prompt,
        optimized: optimized || prompt,
        tokensBefore,
        tokensAfter,
        improvement,
      });
      setLoading(false);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-[#2C3333]">
      <Header />

      <main className="py-12">
        <div className="container mx-auto px-4">
          {/* 타이틀 + 입력 섹션 (가로 배치) */}
          {/* 타이틀 + 입력 섹션 (가로 배치) */}
          <div className="grid md:grid-cols-2 gap-8 items-center mb-12 max-w-4xl mx-auto">
            {/* 왼쪽: 타이틀 */}
            <div>
              <h1 className="text-5xl font-bold text-white mb-4 leading-tight">
                AI Tasker:
                <br />
                Efficiency,
                <br />
                Optimization,
                <br />
                Clarity
              </h1>
            </div>

            {/* 오른쪽: 입력 카드 */}
            <div>
              <div className="bg-[#135D66] p-6 rounded-lg border border-[#77B0AA]">
                <h2 className="text-xl font-bold text-white mb-4">
                  프롬프트 최적화 프로토콜
                </h2>
                <PromptInput onOptimize={handleOptimize} />
              </div>
            </div>
          </div>

          {/* 로딩 */}
          {loading && (
            <div className="text-center mt-8">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#77B0AA]"></div>
              <p className="text-lg text-[#E3FEF7] mt-4">최적화 중...</p>
            </div>
          )}

          {/* 결과 섹션 */}
          {result && !loading && (
            <>
              <OptimizedResult
                optimized={result.optimized}
                tokensAfter={result.tokensAfter}
                improvement={result.improvement}
              />

              <StatsCards
                tokensBefore={result.tokensBefore}
                tokensAfter={result.tokensAfter}
              />
            </>
          )}
        </div>
      </main>
    </div>
  );
}
