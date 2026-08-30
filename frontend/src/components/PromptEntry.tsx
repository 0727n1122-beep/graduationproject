"use client";

// ============================================================
// PromptEntry.tsx — /diagnose의 초기 입력 화면.
// DiagnosisCards와 같은 시트/아쿠아블루 톤으로 통일 (기존 PromptInput.tsx는
// 구 팔레트라 여기서는 재사용하지 않음).
// ============================================================

interface PromptEntryProps {
  prompt: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  loading: boolean;
  error: string | null;
}

export default function PromptEntry({ prompt, onChange, onSubmit, loading, error }: PromptEntryProps) {
  const charCount = prompt.length;

  return (
    <div className="flex flex-col gap-[22px]">
      <div>
        <div className="mb-1.5 font-mono text-[11px] font-extrabold tracking-[.08em] text-[#0891B2] uppercase">
          03 · 첨삭 노트
        </div>
        <h1 className="text-[26px] font-extrabold tracking-tight text-[#182430]">프롬프트 첨삭</h1>
        <div className="mt-1 text-[12.5px] font-semibold text-[#9AA4B0]">
          쓰던 프롬프트를 그대로 붙여넣으세요. 다듬을 필요 없어요.
        </div>
      </div>

      <div className="rounded-xl border border-[#E4E8EE] bg-white p-6">
        <textarea
          value={prompt}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              onSubmit();
            }
          }}
          placeholder="여기에 프롬프트를 붙여넣으세요..."
          rows={10}
          disabled={loading}
          className="w-full resize-none rounded-lg border border-[#E4E8EE] bg-[#F5F7F9] p-4 text-[15px] leading-[1.8] text-[#182430] outline-none focus:border-[#00C9C8] focus:bg-white"
        />
        <div className="mt-3 flex items-center justify-between">
          <span className="font-mono text-[11.5px] font-bold text-[#9AA4B0]">{charCount} 글자</span>
          <button
            onClick={onSubmit}
            disabled={!prompt.trim() || loading}
            className="h-[38px] rounded-[9px] bg-[#00C9C8] px-5 text-[13px] font-bold text-white transition-colors hover:bg-[#0891B2] disabled:cursor-not-allowed disabled:bg-[#D4D9E0]"
          >
            {loading ? "진단 중…" : "첨삭 시작하기"}
          </button>
        </div>
        {error && (
          <p className="mt-3 rounded-lg border border-[#F5C2C4] bg-[#FDECEC] px-3.5 py-2.5 text-[12.5px] font-semibold text-[#E5484D]">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
