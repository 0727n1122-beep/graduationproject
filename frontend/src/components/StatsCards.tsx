"use client";

interface StatsCardsProps {
  tokensBefore: number;
  tokensAfter: number;
  scoreBefore: number;
  scoreAfter: number;
}

export default function StatsCards({
  tokensBefore,
  tokensAfter,
  scoreBefore,
  scoreAfter,
}: StatsCardsProps) {
  const savedTokens = tokensBefore - tokensAfter;
  const savedPercent = Math.round((savedTokens / tokensBefore) * 100);

  // 임시 비용 계산 (GPT-4 기준: $0.03/1K tokens)
  const costBefore = ((tokensBefore / 1000) * 0.03).toFixed(4);
  const costAfter = ((tokensAfter / 1000) * 0.03).toFixed(4);
  const savedCost = (Number(costBefore) - Number(costAfter)).toFixed(4);

  const stats = [
    {
      title: "토큰 절감",
      value: savedTokens,
      unit: "tokens",
      change: `-${savedPercent}%`,
      color: "blue",
      icon: "💰",
    },
    {
      title: "비용 절감",
      value: `$${savedCost}`,
      subtitle: `($${costBefore} → $${costAfter})`,
      color: "green",
      icon: "💵",
    },
    {
      title: "Before 점수",
      value: scoreBefore,
      unit: "/100",
      color: "red",
      icon: "📊",
    },
    {
      title: "After 점수",
      value: scoreAfter,
      unit: "/100",
      color: "emerald",
      icon: "📈",
    },
  ];

  const colorClasses: Record<string, string> = {
    blue: "bg-blue-50 border-blue-200 text-blue-800",
    green: "bg-green-50 border-green-200 text-green-800",
    red: "bg-red-50 border-red-200 text-red-800",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-800",
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 max-w-4xl mx-auto">
      {stats.map((stat, index) => (
        <div
          key={index}
          className={`p-4 rounded-lg border ${colorClasses[stat.color]}`}
        >
          <div className="text-2xl mb-2">{stat.icon}</div>
          <div className="text-xs font-medium mb-1">{stat.title}</div>
          <div className="text-2xl font-bold">
            {stat.value}
            {stat.unit && <span className="text-sm ml-1">{stat.unit}</span>}
          </div>
          {stat.change && (
            <div className="text-xs mt-1 font-semibold">{stat.change}</div>
          )}
          {stat.subtitle && (
            <div className="text-xs mt-1 opacity-75">{stat.subtitle}</div>
          )}
        </div>
      ))}
    </div>
  );
}
