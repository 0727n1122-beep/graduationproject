"use client";

interface OptimizedResultProps {
  optimized: string;
  tokensAfter: number;
  improvement: number;
}

export default function OptimizedResult({
  optimized,
  tokensAfter,
  improvement,
}: OptimizedResultProps) {
  return (
    <div className="mt-4 max-w-4xl mx-auto p-10 bg-[#135D66] rounded-lg shadow-lg border border-[#77B0AA]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-white">최적화 결과</h3>
      </div>

      <div className="p-6 bg-[#CBE4DE] min-h-[200px] rounded-lg border border-[#135D66]">
        <p className="text-[#000000] whitespace-pre-wrap leading-relaxed">
          {optimized}
        </p>
      </div>

      <div className="mt-6 flex items-center justify-between text-sm">
        <span className="text-[#77B0AA] font-mono">{tokensAfter} tokens</span>
        <span className="text-[#E3FEF7] font-semibold">
          +{improvement}% 절감
        </span>
      </div>
    </div>
  );
}
