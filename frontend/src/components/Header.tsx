"use client";

export default function Header() {
  return (
    <header className="bg-[#2C3333] border-b border-[#135D66]">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        {/* 로고 */}
        <div className="flex items-center gap-2">
          <div className="text-[#77B0AA] text-2xl font-bold">▲</div>
          <span className="text-white text-xl font-bold">AI Tasker</span>
        </div>

        {/* 네비게이션 */}
        <nav className="hidden md:flex items-center gap-6">
          <a href="#" className="text-gray-300 hover:text-white transition">
            Features
          </a>
          <a href="#" className="text-gray-300 hover:text-white transition">
            Pricing
          </a>
          <a href="#" className="text-gray-300 hover:text-white transition">
            Contact
          </a>
          <button className="bg-[#135D66] hover:bg-[#77B0AA] text-white px-6 py-2 rounded-lg transition">
            Login
          </button>
        </nav>
      </div>
    </header>
  );
}
