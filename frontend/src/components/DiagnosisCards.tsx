"use client";

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

interface DiagnosisCardsProps {
  issues: Issue[];
  improvements?: string[]; // 백엔드가 따로 줄 때만 사용. 없으면 guide.tip에서 생성
}

export default function DiagnosisCards({
  issues,
  improvements,
}: DiagnosisCardsProps) {
  // improvements가 따로 안 오면, 각 issue의 guide.tip에서 중복 없이 생성
  const derivedImprovements =
    improvements && improvements.length > 0
      ? improvements
      : Array.from(
          new Set(
            (issues || [])
              .map((issue) => issue.guide?.tip)
              .filter((tip): tip is string => Boolean(tip)),
          ),
        );

  // 문제점·개선 포인트가 모두 없으면 섹션 자체를 렌더링하지 않음 (앱이 깨지지 않음)
  if ((!issues || issues.length === 0) && derivedImprovements.length === 0) {
    return null;
  }

  return (
    <div className="grid md:grid-cols-2 gap-6 mt-12 max-w-6xl mx-auto">
      {/* 발견된 문제점 */}
      <div className="bg-[#135D66] p-8 rounded-lg shadow-lg">
        <h3 className="text-[22px] font-bold text-[#FF8A8A] mb-6">
          발견된 문제점
        </h3>

        {issues && issues.length > 0 ? (
          <ul className="divide-y divide-white/10">
            {issues.map((issue, i) => (
              <li key={i} className="flex gap-3 py-4 first:pt-0 last:pb-0">
                <span className="text-[#FF8A8A] leading-7 shrink-0">•</span>
                <p className="text-[#E3FEF7] text-[16px] leading-7">
                  {issue.snippet && (
                    <span className="font-semibold text-white">
                      &ldquo;{issue.snippet}&rdquo;{" "}
                    </span>
                  )}
                  {issue.snippet ? "— " : ""}
                  {issue.explanation}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[#CBE4DE] text-[15px]">발견된 문제점이 없습니다.</p>
        )}
      </div>

      {/* 개선 포인트 */}
      <div className="bg-[#135D66] p-8 rounded-lg shadow-lg">
        <h3 className="text-[22px] font-bold text-[#86E2A8] mb-6">
          개선 포인트
        </h3>

        {derivedImprovements.length > 0 ? (
          <ul className="divide-y divide-white/10">
            {derivedImprovements.map((point, i) => (
              <li key={i} className="flex gap-3 py-4 first:pt-0 last:pb-0">
                <span className="text-[#86E2A8] leading-7 shrink-0">✓</span>
                <p className="text-[#E3FEF7] text-[16px] leading-7">{point}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[#CBE4DE] text-[15px]">개선 포인트가 없습니다.</p>
        )}
      </div>
    </div>
  );
}
