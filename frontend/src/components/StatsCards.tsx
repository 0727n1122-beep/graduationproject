"use client";
import Image from "next/image";
interface ModelCost {
  before: number;
  after: number;
}
interface StatsCardsProps {
  tokensBefore: number;
  tokensAfter: number;
  costs: Record<string, ModelCost>;
}
export default function StatsCards({
  tokensBefore,
  tokensAfter,
  costs,
}: StatsCardsProps) {
  const savedTokens = tokensBefore - tokensAfter;
  const savedPercent = Math.round((savedTokens / tokensBefore) * 100);
  const modelLabels: Record<string, string> = {
    "claude-opus-4": "Opus",
    "claude-sonnet-4": "Sonnet",
    "claude-haiku-3-5": "Haiku",
    "gpt-4o": "GPT-4o",
    "gpt-4o-mini": "GPT-mini",
    "gemini-2-5-pro": "Gem-Pro",
    "gemini-2-5-flash": "Gem-Flash",
  };
  const maxCost =
    costs && Object.keys(costs).length > 0
      ? Math.max(...Object.values(costs).map((c) => c.before))
      : 0;
  const maxTokens = Math.max(tokensBefore, tokensAfter);
  return (
    <div className="grid md:grid-cols-2 gap-6 mt-12 max-w-6xl mx-auto">
      {/* 토큰 절감 카드 */}
      <div className="bg-[#CBE4DE] p-6 rounded-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[#003C43] text-[20px] font-bold">토큰 절감</h3>
          <Image
            src="/icons/token.svg"
            alt="Token"
            width={32}
            height={32}
            className="w-8 h-8"
          />
        </div>
        <div className="mb-4 flex items-center gap-3">
          <div className="text-[22px] font-bold text-[#003C43]">
            {savedTokens >= 0 ? "+" : ""}
            {savedTokens}
          </div>
          <div className="text-[16px] font-semibold text-[#4e7a76] mt-1">
            tokens 절감 ({savedTokens >= 0 ? "+" : ""}
            {savedPercent}%)
          </div>
        </div>
        {/* 토큰 절감 바 차트 */}
        <div className="mt-15 flex items-end gap-3" style={{ height: "80px" }}>
          <div className="flex flex-col items-center gap-1 flex-1">
            <div
              className="w-full bg-[#135D66] rounded-t"
              style={{ height: `${(tokensBefore / maxTokens) * 100}px` }}
            />
            <span className="text-[12px] text-[#003C43] font-semibold">
              Before
            </span>
          </div>
          <div className="flex flex-col items-center gap-1 flex-1 h-full">
            <div
              className="w-full bg-[#77B0AA] rounded-t"
              style={{ height: `${(tokensAfter / maxTokens) * 100}px` }}
            />
            <span className="text-[12px] text-[#003C43] font-semibold">
              After
            </span>
          </div>
        </div>
      </div>
      {/* 모델별 비용 비교 카드 */}
      <div className="bg-[#CBE4DE] p-6 rounded-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[#003C43] text-[20px] font-bold">
            모델별 비용 비교
          </h3>
          <Image
            src="/icons/money.svg"
            alt="Dollar"
            width={32}
            height={32}
            className="w-8 h-8"
          />
        </div>
        {/* 모델별 바 차트 */}
        <div
          className="flex items-end gap-1 mt-12"
          style={{ height: "120px", overflow: "hidden" }}
        >
          {Object.entries(costs || {}).map(([model, cost]) => (
            <div
              key={model}
              className="flex flex-col items-center gap-1 flex-1 h-full"
            >
              <div
                className="w-full flex items-end gap-[2px]"
                style={{ height: "100px" }}
              >
                <div
                  className="flex-1 bg-[#135D66] rounded-t"
                  style={{ height: `${(cost.before / maxCost) * 100}%` }}
                />
                <div
                  className="flex-1 bg-[#77B0AA] rounded-t"
                  style={{ height: `${(cost.after / maxCost) * 100}%` }}
                />
              </div>
              <span className="text-[8px] text-[#003C43] font-semibold text-center leading-tight">
                {modelLabels[model] || model}
              </span>
            </div>
          ))}
        </div>
        {/* 범례 */}
        <div className="flex gap-4 mt-2">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-[#135D66] rounded" />
            <span className="text-[10px] font-semibold text-[#003C43]">
              Before
            </span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-[#77B0AA] rounded" />
            <span className="text-[10px] font-semibold text-[#003C43]">
              After
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
