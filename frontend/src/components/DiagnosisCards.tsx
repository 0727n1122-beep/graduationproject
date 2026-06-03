"use client";
import Image from "next/image";
import { useState } from "react";

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
  improvements?: string[];
  original?: string;
}

export default function DiagnosisCards({
  issues,
  improvements,
  original,
}: DiagnosisCardsProps) {
  const [copied, setCopied] = useState(false);

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

  const hasIssues = issues && issues.length > 0;
  const hasImprovements = derivedImprovements.length > 0;

  const handleCopy = () => {
    if (original) {
      navigator.clipboard.writeText(original);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!hasIssues && !hasImprovements) {
    return (
      <div className="mt-12 max-w-6xl mx-auto">
        <div className="bg-[#0E8388] p-8 rounded-lg shadow-lg flex items-center gap-6">
          {/* 왼쪽 아이콘 */}
          <div className="shrink-0">
            <Image
              src="/icons/certificate2.svg"
              alt="certificate"
              width={64}
              height={64}
            />
          </div>
          {/* 텍스트 */}
          <div className="flex-1">
            <p className="text-[13px] text-[#86E2A8] font-semibold mb-1">
              Certified Prompt Quality Report
            </p>
            <h3 className="text-[20px] font-bold text-white mb-2">
              Top-Quality Prompt
            </h3>
            <p className="text-[#CBE4DE] text-[16px] leading-6">
              명확하고 구조화된 프롬프트입니다. 바로 사용해도 좋아요.
            </p>
          </div>
          {/* 복사 버튼 */}
          <button
            onClick={handleCopy}
            className="shrink-0 px-4 py-2.5 bg-[#2C3333] text-[#CBE4DE] text-[14px] font-bold rounded-lg hover:bg-[#CBE4DE] hover:text-[#2C3333] transition-colors whitespace-nowrap"
          >
            {copied ? "✓ Copied!" : "Copy Prompt"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-2 gap-6 mt-12 max-w-6xl mx-auto">
      {/* 발견된 문제점 */}
      <div className="bg-[#135D66] p-8 rounded-lg shadow-lg">
        <h3 className="text-[22px] font-bold text-[#FF8A8A] mb-6">
          발견된 문제점
        </h3>
        {hasIssues ? (
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
          <p className="text-[#CBE4DE] text-[15px]">
            발견된 문제점이 없습니다.
          </p>
        )}
      </div>
      {/* 개선 포인트 */}
      <div className="bg-[#135D66] p-8 rounded-lg shadow-lg">
        <h3 className="text-[22px] font-bold text-[#86E2A8] mb-6">
          개선 포인트
        </h3>
        {hasImprovements ? (
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
