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
    <div className="mt-4 max-w-6xl mx-auto p-8 bg-[#135D66] rounded-lg shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[22px] font-semibold text-[#ffffff]">
          최적화 결과
        </h3>
      </div>

      <div className="p-6  bg-[#CBE4DE]  rounded-lg min-h-[250px]">
        <p className="text-black text-[20px] whitespace-pre-wrap leading-relaxed">
          {optimized}
        </p>
      </div>

      <div className="mt-8 flex items-center justify-between text-sm">
        <span className="text-[#CBE4DE] text-lg font-semibold">
          {tokensAfter} tokens
        </span>
        <span className="text-[#CBE4DE] text-lg font-semibold">
          {improvement > 0 ? "+" : ""}
          {improvement}% 절감
        </span>
      </div>
    </div>
  );
}
