"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

// ============================================================
// LandingPage — Minifi 소개/랜딩 페이지
// ------------------------------------------------------------
// 아쿠아 목업의 랜딩 섹션을 React + Tailwind로 이식.
// 구성: 히어로 → 문제제기+기능3 → 이용방법3단계 → CTA
// 스크롤 진입 시 페이드인(data-reveal) 유지, reduced-motion 존중.
// CTA/시작 버튼 → /auth (로그인·회원가입) 로 연결.
// ============================================================

export default function LandingPage() {
  const rootRef = useRef<HTMLDivElement>(null);

  // 스크롤 진입 시 요소 페이드인 (IntersectionObserver)
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const els = Array.from(root.querySelectorAll<HTMLElement>("[data-reveal]"));

    if (prefersReduced) {
      els.forEach((el) => el.classList.add("is-in"));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 },
    );

    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div ref={rootRef} className="min-h-screen bg-white text-[#182430]">
      {/* reveal 애니메이션용 스타일 (전역 globals.css로 옮겨도 됨) */}
      <style>{`
        [data-reveal]{opacity:0;transform:translateY(16px);transition:opacity .6s ease,transform .6s ease}
        [data-reveal].is-in{opacity:1;transform:none}
        @keyframes ud-click{0%{opacity:.9;transform:scale(.4)}70%{opacity:.35;transform:scale(1.5)}100%{opacity:0;transform:scale(1.9)}}
        @media (prefers-reduced-motion: reduce){
          [data-reveal]{transition:none}
          .ud-cursor{display:none}
        }
      `}</style>

      {/* ── 히어로 ─────────────────────────────── */}
      <section className="flex min-h-screen flex-col items-center justify-center px-6 py-24 text-center">
        <div className="mx-auto max-w-[640px]">
          <div
            data-reveal
            className="mb-5 text-[12px] font-extrabold tracking-[0.22em] text-[#0891B2]"
          >
            MINIFI
          </div>
          <h1 className="text-[44px] font-black leading-[1.28] tracking-[-0.03em] sm:text-[58px]">
            <span data-reveal className="block">
              그 프롬프트,
            </span>
            <span
              data-reveal
              className="block"
              style={{ transitionDelay: ".08s" }}
            >
              정말 이대로{" "}
              <em className="bg-gradient-to-r from-[#00C9C8] to-[#22D3EE] bg-clip-text not-italic text-transparent">
                보내도
              </em>{" "}
              될까요?
            </span>
          </h1>
          <p
            data-reveal
            className="mt-5 text-[16px] font-semibold leading-[1.6] text-[#5C6773]"
            style={{ transitionDelay: ".16s" }}
          >
            어디가 왜 문제인지 짚어드리고, 있어야 할 조건까지 채워드려요.
          </p>

          {/* 데모 카드 (지저분 → 깔끔) */}
          <div
            data-reveal
            className="mt-10 overflow-hidden rounded-[16px] border border-[#E4E8EE] bg-white text-left shadow-[0_10px_40px_-16px_rgba(20,24,30,0.2)]"
            style={{ transitionDelay: ".24s" }}
          >
            <div className="flex gap-1.5 border-b border-[#EEF1F4] bg-[#F5F7F9] px-4 py-3">
              <span className="h-2.5 w-2.5 rounded-full bg-[#E4E8EE]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#E4E8EE]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#E4E8EE]" />
            </div>
            <HeroDemoText />
          </div>
        </div>

        <div
          data-reveal
          className="mt-14 flex flex-col items-center gap-2 text-[12px] font-semibold text-[#9AA4B0]"
          style={{ transitionDelay: ".4s" }}
        >
          <span>스크롤해서 더 보기</span>
          <svg
            className="h-5 w-5 animate-bounce"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M12 5v14M6 13l6 6 6-6" />
          </svg>
        </div>
      </section>

      {/* ── 문제 제기 + 기능 3개 ─────────────────── */}
      <section className="flex min-h-screen flex-col justify-center bg-[#F5F7F9] px-6 py-24">
        <div className="mx-auto max-w-[560px] text-center">
          <p
            data-reveal
            className="text-[26px] font-black leading-[1.4] tracking-[-0.02em] sm:text-[32px]"
          >
            몇 번을 다시 물어봐도
            <br />
            자꾸 어긋난다면.
          </p>
          <p
            data-reveal
            className="mt-4 text-[15px] font-semibold leading-[1.7] text-[#5C6773]"
            style={{ transitionDelay: ".1s" }}
          >
            문제는 AI가 아니라, AI가 무엇을 알아야 하는지
            <br />
            알려주지 않은 것일 수 있어요.
          </p>
        </div>

        <div className="mx-auto mt-16 w-full max-w-[900px]">
          <div className="mb-5 text-center text-[12px] font-extrabold uppercase tracking-[0.18em] text-[#9AA4B0]">
            무엇을 하나요
          </div>
          <div className="grid grid-cols-1 gap-[18px] md:grid-cols-3">
            {FEATURES.map((f, i) => (
              <div
                key={f.title}
                data-reveal
                className="rounded-[18px] border border-[#E4E8EE] bg-white p-[30px_24px]"
                style={{ transitionDelay: `${i * 0.08}s` }}
              >
                <div className="mb-[18px] text-[#0891B2]">{f.icon}</div>
                <h3 className="mb-2 text-[17px] font-extrabold tracking-[-0.01em]">
                  {f.title}
                </h3>
                <p className="text-[13.5px] font-medium leading-[1.65] text-[#5C6773]">
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 이용 방법 3단계 ─────────────────────── */}
      <section className="flex min-h-screen flex-col justify-center px-6 py-24">
        <div className="mx-auto w-full max-w-[900px]">
          <div
            data-reveal
            className="mb-2 text-[12px] font-extrabold uppercase tracking-[0.18em] text-[#9AA4B0]"
          >
            이용 방법
          </div>
          <div data-reveal style={{ transitionDelay: ".05s" }}>
            <UseDemo />
          </div>
          <div className="mt-10 grid grid-cols-1 gap-8 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <div
                key={s.n}
                data-reveal
                style={{ transitionDelay: `${0.1 + i * 0.08}s` }}
              >
                <span className="text-[28px] font-black text-[#A5E8E7]">
                  {s.n}
                </span>
                <h3 className="mt-2 text-[17px] font-extrabold">{s.title}</h3>
                <p className="mt-2 text-[14px] font-medium leading-[1.7] text-[#5C6773]">
                  {s.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────── */}
      <section className="flex min-h-screen flex-col items-center justify-center bg-[#F5F7F9] px-6 py-24 text-center">
        <div className="mx-auto max-w-[560px]">
          <p
            data-reveal
            className="text-[13px] font-bold tracking-[0.06em] text-[#5C6773]"
          >
            <b className="text-[#0891B2]">Minifi</b>
            <span className="text-[#9AA4B0]">:</span> Efficiency, Optimization,
            Clarity
          </p>
          <p
            data-reveal
            className="mt-4 text-[30px] font-black leading-[1.4] tracking-[-0.02em] sm:text-[38px]"
            style={{ transitionDelay: ".06s" }}
          >
            지금, 프롬프트 하나로
            <br />
            확인해보세요.
          </p>
          <Link
            href="/auth"
            data-reveal
            className="mt-8 inline-block rounded-[12px] bg-[#00C9C8] px-9 py-4 text-[16px] font-extrabold text-white shadow-[0_14px_30px_-10px_rgba(0,201,200,0.55)] transition-all hover:-translate-y-0.5 hover:bg-[#0891B2] hover:shadow-[0_18px_36px_-10px_rgba(0,201,200,0.6)]"
            style={{ transitionDelay: ".16s" }}
          >
            Minifi 시작하기
          </Link>
          <p
            data-reveal
            className="mt-4 text-[12px] font-semibold text-[#9AA4B0]"
            style={{ transitionDelay: ".24s" }}
          >
            가입 없이 바로 써볼 수 있어요
          </p>
        </div>
      </section>
    </div>
  );
}

// ── 데이터 ────────────────────────────────────
const FEATURES = [
  {
    title: "짚어드려요",
    desc: "군더더기·중복·모호한 표현을 색으로 표시하고, 이유와 함께 보여줘요.",
    icon: (
      <svg className="h-[26px] w-[26px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M4 19l4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 19Z" />
      </svg>
    ),
  },
  {
    title: "나눠드려요",
    desc: "한 번에 너무 많은 요청은 순서대로 쪼개서 하나씩 진행하게 해요.",
    icon: (
      <svg className="h-[26px] w-[26px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M4 6h16M4 12h10M4 18h13" />
      </svg>
    ),
  },
  {
    title: "비교해드려요",
    desc: "같은 프롬프트가 모델마다 얼마나 다른지 예상 비용으로 보여줘요.",
    icon: (
      <svg className="h-[26px] w-[26px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M4 19V10M10 19V5M16 19v-7M4 19h16" />
      </svg>
    ),
  },
];

const STEPS = [
  { n: "01", title: "프롬프트를 붙여넣어요", desc: "쓰던 프롬프트를 그대로 가져와요. 다듬을 필요 없어요." },
  { n: "02", title: "표시된 부분을 확인해요", desc: "색으로 표시된 곳에 이유가 함께 떠요. 적용하거나 건너뛰면 돼요." },
  { n: "03", title: "완료를 눌러 비교해요", desc: "최적화된 프롬프트와 모델별 예상 비용을 한 화면에서 봐요." },
];

// ── 히어로 데모 카드: "지저분한 프롬프트" ↔ "정리된 프롬프트" 크로스페이드 ──
// 두 문단을 grid의 같은 셀에 겹쳐서(grid-area 1/1) 배치 — absolute 포지셔닝 없이도
// 카드 높이가 더 긴 쪽에 맞춰 자연스럽게 정해지고, opacity만 토글하면 됨.
function HeroDemoText() {
  const [showClean, setShowClean] = useState(false);

  useEffect(() => {
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReduced) {
      setShowClean(true); // 애니메이션 없이 최종(정리된) 상태로 고정
      return;
    }
    const id = setInterval(() => setShowClean((v) => !v), 3200);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="grid p-5 text-[14px] leading-[1.7]">
      <p
        className={`[grid-area:1/1] text-[#9AA4B0] transition-all duration-500 ${
          showClean ? "opacity-0" : "opacity-100"
        }`}
      >
        음 저기 혹시 가능하면{" "}
        <u className="decoration-[#E5484D] decoration-wavy">
          로그인이랑 상품목록이랑 장바구니
        </u>
        까지{" "}
        <u className="decoration-[#E5484D] decoration-wavy">전부 다</u>{" "}
        만들어주시고,{" "}
        <u className="decoration-[#E5484D] decoration-wavy">이거</u> 좀
        어떻게든 해주세요.
      </p>
      <p
        className={`[grid-area:1/1] text-[#182430] transition-all duration-500 ${
          showClean ? "opacity-100" : "opacity-0"
        }`}
      >
        다음 순서로 진행해주세요 —{" "}
        <b className="font-bold">1) 로그인</b>{" "}
        <b className="font-bold">2) 상품 목록</b>{" "}
        <b className="font-bold">3) 장바구니</b>{" "}
        <span className="ml-1 inline-block rounded-md bg-[#E0F7F7] px-2 py-0.5 text-[12px] font-bold text-[#0891B2]">
          ＋조건 Python으로 작성
        </span>
      </p>
    </div>
  );
}

// ── "이용 방법" 미니 데모: 클릭 → 텍스트 수정 → 조건 칩 추가 → 토큰 감소, 반복 ──
// 목업(ud-demo)의 타임라인을 그대로 이식. 색상은 목업의 민트 팔레트가 아니라
// 이 페이지가 이미 쓰고 있는 아쿠아 팔레트(#00C9C8/#0891B2/#E0F7F7)로 맞춤.
function UseDemo() {
  const [fixed, setFixed] = useState(false);
  const [cursorOn, setCursorOn] = useState(false);
  const [chipShown, setChipShown] = useState(false);
  const [tokenNum, setTokenNum] = useState(236);
  const [deltaShown, setDeltaShown] = useState(false);

  useEffect(() => {
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReduced) {
      // 애니메이션 없이 최종 상태로 고정
      setFixed(true);
      setChipShown(true);
      setTokenNum(204);
      setDeltaShown(true);
      return;
    }

    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const after = (ms: number, fn: () => void) => {
      timers.push(setTimeout(fn, ms));
    };

    function animateTokenNumber(from: number, to: number, dur: number) {
      const t0 = Date.now();
      function step() {
        if (cancelled) return;
        const p = Math.min(1, (Date.now() - t0) / dur);
        setTokenNum(Math.round(from + (to - from) * p));
        if (p < 1) timers.push(setTimeout(step, 20));
      }
      step();
    }

    function cycle() {
      setFixed(false);
      setCursorOn(false);
      setChipShown(false);
      setDeltaShown(false);
      setTokenNum(236);

      after(650, () => setCursorOn(true));
      after(950, () => {
        setFixed(true);
        setCursorOn(false);
      });
      after(2500, () => setChipShown(true));
      after(4400, () => animateTokenNumber(236, 204, 550));
      after(5000, () => setDeltaShown(true));
      after(7600, cycle);
    }
    cycle();

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, []);

  return (
    <div className="mx-auto max-w-[600px] overflow-hidden rounded-[16px] border border-[#E4E8EE] bg-white shadow-[0_24px_56px_-28px_rgba(20,30,40,0.24)]">
      <div className="flex gap-2.5 border-b border-[#EEF1F4] px-[18px] py-3.5">
        <span className="h-2.5 w-2.5 rounded-full bg-[#E4E8EE]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#E4E8EE]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#E4E8EE]" />
      </div>
      <div className="p-[34px_34px_30px]">
        <p className="mb-6 text-[19px] leading-[1.75] text-[#182430]">
          <span className="relative inline-block">
            {cursorOn && (
              <span
                className="ud-cursor pointer-events-none absolute -left-1.5 -top-1.5 h-[22px] w-[22px] rounded-full border-[3px] border-[#0891B2]"
                style={{ animation: "ud-click .55s ease-out" }}
              />
            )}
            <span
              className={
                fixed
                  ? "rounded-[5px] bg-[#E0F7F7] px-[5px] font-bold text-[#0891B2] after:ml-[3px] after:text-[13px] after:font-extrabold after:content-['✓']"
                  : "border-b-2 border-dotted border-[#E5484D]"
              }
            >
              {fixed ? "장바구니 담기 버튼" : "이거"}
            </span>
          </span>{" "}
          좀 어떻게든 해주세요.
        </p>
        <div className="min-h-[36px]">
          <span
            className={`inline-block rounded-[9px] border border-[#A5E8E7] bg-[#E0F7F7] px-[13px] py-[7px] text-[15px] font-extrabold text-[#0891B2] transition-all duration-400 ${
              chipShown
                ? "translate-y-0 scale-100 opacity-100"
                : "translate-y-1.5 scale-95 opacity-0"
            }`}
          >
            ＋조건 Python으로 작성해주세요
          </span>
        </div>
        <div className="mt-5 flex items-center justify-between border-t border-[#EEF1F4] pt-5">
          <span className="text-[14px] font-bold text-[#9AA4B0]">
            예상 토큰
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[26px] font-extrabold tabular-nums text-[#182430]">
              {tokenNum}
            </span>
            <span
              className={`rounded-[8px] bg-[#E0F7F7] px-[9px] py-1 text-[14px] font-extrabold text-[#0891B2] transition-opacity duration-400 ${
                deltaShown ? "opacity-100" : "opacity-0"
              }`}
            >
              −32 · −14%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
