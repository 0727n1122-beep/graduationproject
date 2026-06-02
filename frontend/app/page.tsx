"use client";

import { useState } from "react";
import Header from "@/src/components/Header";
import PromptInput from "@/src/components/PromptInput";
import OptimizedResult from "@/src/components/OptimizedResult";
import StatsCards from "@/src/components/StatsCards";
import DiagnosisCards from "@/src/components/DiagnosisCards";

interface Guide {
  title?: string;
  tip?: string;
  example_bad?: string;
  example_good?: string;
}

interface Issue {
  category?: string;
  snippet?: string;
  explanation: string;
  guide?: Guide;
}

interface OptimizeResult {
  original: string;
  optimized: string;
  tokensBefore: number;
  tokensAfter: number;
  improvement: number;
  costs: Record<string, ModelCost> | null; // 모델별 비용 정보 추가
  issues: Issue[]; // 발견된 문제점 (+ 각 issue의 guide.tip = 개선 포인트)
}

interface ModelCost {
  before: number;
  after: number;
}

export default function Home() {
  const [result, setResult] = useState<OptimizeResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleOptimize = async (prompt: string) => {
    setLoading(true);

    try {
      const response = await fetch(
        "https://graduationproject-production-14f7.up.railway.app/optimize",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ prompt }),
        },
      );

      const data = await response.json();

      // 에러 응답 처리
      if (data.error) {
        alert(data.error); // "프롬프트가 너무 짧습니다." 등
        return;
      }

      setResult({
        original: prompt,
        optimized: data.optimized_prompt,
        tokensBefore: data.original_tokens,
        tokensAfter: data.optimized_tokens,
        improvement: data.saved_percent,
        costs: data.costs, // 모델별 비용 정보 추가
        issues: data.issues ?? [], // 없으면 빈 배열 → 진단 카드 미표시
      });
    } catch (error) {
      console.error("최적화 실패:", error);
      alert("최적화 중 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#2C3333]">
      <Header />

      <main className="py-12">
        <div className="container mx-auto px-4">
          {/* 타이틀 + 입력 섹션 (가로 배치) */}
          <div className="grid md:grid-cols-[1fr_1.5fr] gap-8 items-center mb-12 max-w-6xl mx-auto">
            {/* 왼쪽: 타이틀 */}
            <div>
              <h1 className="text-6xl font-bold text-[#f0fbfa] mb-6 leading-tight">
                Minifi :
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
              <div className="bg-[#135D66] p-6 rounded-lg min-w-[300px]">
                <h2 className="text-[22px] font-semibold text-white mb-10">
                  프롬프트 최적화 프로토콜
                </h2>
                <PromptInput onOptimize={handleOptimize} />
              </div>
            </div>
          </div>

          {/* 로딩 */}
          {loading && (
            <div className="text-center mt-10">
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
                costs={result.costs || {}}
              />
              {/* 맨 밑에 추가된 진단 카드 (개선 포인트는 issue.guide.tip에서 자동 생성) */}
              <DiagnosisCards issues={result.issues} />
            </>
          )}
        </div>
      </main>
    </div>
  );
}
