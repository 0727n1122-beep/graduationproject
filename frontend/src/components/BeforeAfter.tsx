"use client";

interface BeforeAfterProps {
  original: string;
  optimized: string;
  tokensBefore: number;
  tokensAfter: number;
}

export default function BeforeAfter({
  original,
  optimized,
  tokensBefore,
  tokensAfter,
}: BeforeAfterProps) {
  if (!original || !optimized) return null;

  const savedTokens = tokensBefore - tokensAfter;
  const savedPercent = Math.round((savedTokens / tokensBefore) * 100);

  return (
    <div className="mt-8 max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h3 className="text-2xl font-bold mb-6 text-gray-800">최적화 결과</h3>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Before */}
        <div className="p-4 bg-red-50 rounded-lg border border-red-200">
          <h4 className="font-semibold mb-3 text-red-800 flex items-center">
            <span className="mr-2">❌</span> Before
          </h4>
          <p className="text-sm text-gray-700 whitespace-pre-wrap mb-3 min-h-[100px]">
            {original}
          </p>
          <div className="flex items-center justify-between text-xs pt-3 border-t border-red-200">
            <span className="text-gray-600 font-mono">
              {tokensBefore} tokens
            </span>
            <span className="text-red-600 font-semibold">비효율적</span>
          </div>
        </div>

        {/* After */}
        <div className="p-4 bg-green-50 rounded-lg border border-green-200">
          <h4 className="font-semibold mb-3 text-green-800 flex items-center">
            <span className="mr-2">✅</span> After
          </h4>
          <p className="text-sm text-gray-700 whitespace-pre-wrap mb-3 min-h-[100px]">
            {optimized}
          </p>
          <div className="flex items-center justify-between text-xs pt-3 border-t border-green-200">
            <span className="text-gray-600 font-mono">
              {tokensAfter} tokens
            </span>
            <span className="text-green-600 font-semibold">
              -{savedPercent}% 절감
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
