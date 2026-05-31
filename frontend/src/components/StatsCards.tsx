"use client";

interface StatsCardsProps {
  tokensBefore: number;
  tokensAfter: number;
}

export default function StatsCards({
  tokensBefore,
  tokensAfter,
}: StatsCardsProps) {
  const savedTokens = tokensBefore - tokensAfter;
  const savedPercent = Math.round((savedTokens / tokensBefore) * 100);

  // 비용 계산 (GPT-4 기준: $0.03/1K tokens)
  const costBefore = ((tokensBefore / 1000) * 0.03).toFixed(4);
  const costAfter = ((tokensAfter / 1000) * 0.03).toFixed(4);
  const savedCost = (Number(costBefore) - Number(costAfter)).toFixed(4);

  return (
    <div className="grid md:grid-cols-2 gap-6 mt-8 max-w-4xl mx-auto">
      {/* 비용 효율 카드 */}
      <div className="bg-[#CBE4DE] p-6 rounded-lg border-2 border-[#77B0AA]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[#003C43] font-bold">비용 효율</h3>
          <span className="text-2xl">⏱</span>
        </div>

        <div className="mb-4">
          <div className="text-3xl font-bold text-[#003C43]">${savedCost}</div>
          <div className="text-sm text-[#135D66] mt-1">
            절감됨 (${costBefore} → ${costAfter})
          </div>
        </div>

        {/* 간단한 바 차트 */}
        <div className="flex items-end gap-2 h-20">
          {[40, 55, 65, 80, 95].map((height, i) => (
            <div
              key={i}
              className="flex-1 bg-[#135D66] rounded-t"
              style={{ height: `${height}%` }}
            />
          ))}
        </div>
      </div>

      {/* 토큰 절감 카드 */}
      <div className="bg-[#CBE4DE] p-6 rounded-lg border-2 border-[#77B0AA]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[#003C43] font-bold">토큰 절감</h3>
          <span className="text-2xl">💰</span>
        </div>

        <div className="mb-4">
          <div className="text-3xl font-bold text-[#003C43]">{savedTokens}</div>
          <div className="text-sm text-[#135D66] mt-1">
            tokens 절감 (-{savedPercent}%)
          </div>
        </div>

        {/* 간단한 바 차트 */}
        <div className="flex items-end gap-2 h-20">
          {[35, 50, 70, 85, 90].map((height, i) => (
            <div
              key={i}
              className="flex-1 bg-[#77B0AA] rounded-t"
              style={{ height: `${height}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
