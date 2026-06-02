"use client";
import { useState } from "react";

interface PromptInputProps {
  onOptimize: (prompt: string) => void;
}

export default function PromptInput({ onOptimize }: PromptInputProps) {
  const [prompt, setPrompt] = useState("");
  const charCount = prompt.length;

  const handleSubmit = () => {
    if (prompt.trim()) {
      onOptimize(prompt);
    }
  };

  return (
    <div>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="프롬프트를 입력하세요.."
        className="w-full h-70 not-last:p-4 bg-[#CBE4DE] rounded-lg text-[#000000] text-[20px] placeholder-[#9c9c9c] focus:ring-2 focus:ring-[#77B0AA] focus:border-transparent resize-none mb-2 overflow-y-auto"
      />
      <div className="flex justify-between items-center">
        <div className="text-lg text-[#CBE4DE] font-semibold">
          <span className="font-mono">{charCount} 글자</span>
        </div>
        <button
          onClick={handleSubmit}
          disabled={!prompt.trim()}
          className="px-6 py-3 bg-[#10959a] text-[#CBE4DE] text-lg font-semibold rounded-lg hover:bg-[#CBE4DE] hover:text-[#10959a] disabled:bg-[#CBE4DE] disabled:cursor-not-allowed transition-colors"
        >
          최적화하기
        </button>
      </div>
    </div>
  );
}
