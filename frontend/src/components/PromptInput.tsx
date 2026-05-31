"use client";

import { useState } from "react";

interface PromptInputProps {
  onOptimize: (prompt: string) => void;
}

export default function PromptInput({ onOptimize }: PromptInputProps) {
  const [prompt, setPrompt] = useState("");

  const tokenCount = Math.ceil(prompt.length * 2.5);
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
        className="w-full h-40 p-4 bg-[#CBE4DE] border border-[#2E4F4F] rounded-lg text-[#000000] placeholder-[#9c9c9c] focus:ring-2 focus:ring-[#77B0AA] focus:border-transparent resize-none mb-4"
      />

      <div className="flex justify-between items-center">
        <div className="text-sm text-[#E3FEF7]">
          <span className="font-mono">{charCount} 글자 </span>
          <span className="mx-2">|</span>
          <span className="font-mono"> {tokenCount} 토큰</span>
        </div>

        <button
          onClick={handleSubmit}
          disabled={!prompt.trim()}
          className="px-6 py-3 bg-[#10959a] text-[#ffffff] font-semibold rounded-lg hover:bg-[#CBE4DE] disabled:bg-[#CBE4DE] disabled:cursor-not-allowed transition-colors"
        >
          최적화하기
        </button>
      </div>
    </div>
  );
}
