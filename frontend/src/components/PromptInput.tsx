'use client';

import { useState } from 'react';

interface PromptInputProps {
  onOptimize: (prompt: string) => void;
}

export default function PromptInput({ onOptimize }: PromptInputProps) {
  const [prompt, setPrompt] = useState('');
  
  const tokenCount = Math.ceil(prompt.length * 2.5);
  const charCount = prompt.length;

  const handleSubmit = () => {
    if (prompt.trim()) {
      onOptimize(prompt);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-4 text-gray-800">
        프롬프트를 입력하세요
      </h2>
      
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="예: 아 혹시 쇼핑몰 좀 만들어줄 수 있어?"
        className="w-full h-40 p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
      />
      
      <div className="flex justify-between items-center mt-4">
        <div className="text-sm text-gray-600">
          <span className="font-mono">{charCount} 글자</span>
          <span className="mx-2">|</span>
          <span className="font-mono">약 {tokenCount} 토큰</span>
        </div>
        
        <button
          onClick={handleSubmit}
          disabled={!prompt.trim()}
          className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          최적화하기
        </button>
      </div>
    </div>
  );
}