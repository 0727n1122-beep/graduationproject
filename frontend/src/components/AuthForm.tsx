"use client";

import { useState } from "react";

// ============================================================
// AuthForm — 로그인/회원가입 탭 전환 폼
// ------------------------------------------------------------
// 아쿠아 디자인 시스템(#00C9C8) 이식. 탭으로 로그인↔회원가입 전환.
// ⚠ 현재: UI + 형식 유효성 검사만. 실제 인증(백엔드/구글)은 TODO.
// ============================================================

type Mode = "login" | "signup";

interface FieldErrors {
  name?: string;
  email?: string;
  pw?: string;
  pw2?: string;
  agree?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AuthForm() {
  const [mode, setMode] = useState<Mode>("login");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [agree, setAgree] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});

  const isSignup = mode === "signup";

  function switchMode(next: Mode) {
    setMode(next);
    setErrors({});
  }

  // 형식 검사만 수행 (실제 인증 아님)
  function validate(): FieldErrors {
    const e: FieldErrors = {};
    if (isSignup && name.trim().length === 0) e.name = "이름을 입력해주세요.";
    if (!EMAIL_RE.test(email.trim()))
      e.email = "올바른 이메일 형식이 아니에요.";
    if (isSignup) {
      if (pw.length < 8) e.pw = "비밀번호는 8자 이상이어야 해요.";
      if (pw2.length === 0 || pw !== pw2) e.pw2 = "비밀번호가 일치하지 않아요.";
      if (!agree) e.agree = "약관에 동의해주세요.";
    } else {
      if (pw.length === 0) e.pw = "비밀번호를 입력해주세요.";
    }
    return e;
  }

  function handleSubmit() {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    // TODO: 백엔드 인증 API 호출 (로그인/회원가입 분기 + JWT 저장)
    alert(
      `${isSignup ? "회원가입" : "로그인"} 형식 통과! (백엔드 API 연동 예정)`,
    );
  }

  function handleGoogle() {
    // TODO: 구글 OAuth 연동 (아직 연동 전)
    alert("구글 연동 예정입니다.");
  }

  const inputBase =
    "w-full rounded-[10px] border bg-[#F5F7F9] px-[13px] py-[11px] text-[14px] text-[#182430] " +
    "outline-none transition-colors placeholder:text-[#9AA4B0] " +
    "focus:border-[#00C9C8] focus:bg-white";

  function inputCls(hasErr?: string) {
    return `${inputBase} ${hasErr ? "border-[#E5484D] bg-[#FDECEC]" : "border-[#E4E8EE]"}`;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F5F7F9] p-6">
      <div className="w-full max-w-[400px] rounded-[18px] border border-[#E4E8EE] bg-white p-[30px] pt-[34px] shadow-[0_4px_24px_rgba(20,24,30,0.06)]">
        {/* 브랜드 */}
        <div className="mb-1.5 flex items-center justify-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#00C9C8] text-[16px] font-extrabold text-white">
            M
          </div>
          <div className="text-[20px] font-extrabold tracking-[-0.01em]">
            Minifi
          </div>
        </div>
        <p className="mb-6 text-center text-[12.5px] font-semibold text-[#9AA4B0]">
          {isSignup
            ? "몇 초면 가입할 수 있어요"
            : "프롬프트 첨삭을 시작해보세요"}
        </p>

        {/* 탭 */}
        <div className="mb-6 flex rounded-[11px] bg-[#F5F7F9] p-1">
          {(["login", "signup"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => switchMode(m)}
              className={
                "flex-1 rounded-lg py-[9px] text-[13.5px] font-bold transition-colors " +
                (mode === m
                  ? "bg-white text-[#0891B2] shadow-[0_1px_3px_rgba(20,24,30,0.08)]"
                  : "text-[#9AA4B0]")
              }
            >
              {m === "login" ? "로그인" : "회원가입"}
            </button>
          ))}
        </div>

        {/* 이름 (회원가입만) */}
        {isSignup && (
          <div className="mb-4">
            <label
              htmlFor="name"
              className="mb-1.5 block text-[12px] font-bold text-[#5C6773]"
            >
              이름
            </label>
            <input
              id="name"
              type="text"
              placeholder="홍길동"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputCls(errors.name)}
            />
            {errors.name && (
              <p className="mt-1.5 text-[11.5px] font-semibold text-[#E5484D]">
                {errors.name}
              </p>
            )}
          </div>
        )}

        {/* 이메일 */}
        <div className="mb-4">
          <label
            htmlFor="email"
            className="mb-1.5 block text-[12px] font-bold text-[#5C6773]"
          >
            이메일
          </label>
          <input
            id="email"
            type="email"
            placeholder="minifi123@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputCls(errors.email)}
          />
          {errors.email && (
            <p className="mt-1.5 text-[11.5px] font-semibold text-[#E5484D]">
              {errors.email}
            </p>
          )}
        </div>

        {/* 비밀번호 */}
        <div className="mb-4">
          <label
            htmlFor="pw"
            className="mb-1.5 block text-[12px] font-bold text-[#5C6773]"
          >
            비밀번호
          </label>
          <input
            id="pw"
            type="password"
            placeholder={isSignup ? "8자 이상" : "비밀번호 입력"}
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            className={inputCls(errors.pw)}
          />
          {errors.pw && (
            <p className="mt-1.5 text-[11.5px] font-semibold text-[#E5484D]">
              {errors.pw}
            </p>
          )}
        </div>

        {/* 비밀번호 확인 (회원가입만) */}
        {isSignup && (
          <div className="mb-4">
            <label
              htmlFor="pw2"
              className="mb-1.5 block text-[12px] font-bold text-[#5C6773]"
            >
              비밀번호 확인
            </label>
            <input
              id="pw2"
              type="password"
              placeholder="비밀번호를 다시 입력"
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              className={inputCls(errors.pw2)}
            />
            {errors.pw2 && (
              <p className="mt-1.5 text-[11.5px] font-semibold text-[#E5484D]">
                {errors.pw2}
              </p>
            )}
          </div>
        )}

        {/* 약관 동의 (회원가입만) */}
        {isSignup && (
          <div className="mb-[18px]">
            <label className="flex cursor-pointer items-start gap-2 text-[12px] font-semibold text-[#5C6773]">
              <input
                type="checkbox"
                checked={agree}
                onChange={(e) => setAgree(e.target.checked)}
                className="mt-0.5 accent-[#0891B2]"
              />
              <span>
                <a href="#" className="text-[#0891B2] hover:underline">
                  이용약관
                </a>{" "}
                및{" "}
                <a href="#" className="text-[#0891B2] hover:underline">
                  개인정보처리방침
                </a>
                에 동의합니다.
              </span>
            </label>
            {errors.agree && (
              <p className="mt-1.5 text-[11.5px] font-semibold text-[#E5484D]">
                {errors.agree}
              </p>
            )}
          </div>
        )}

        {/* 로그인 유지 + 비번찾기 (로그인만) */}
        {!isSignup && (
          <div className="-mt-1 mb-[18px] flex items-center justify-between">
            <label className="flex cursor-pointer items-center gap-1.5 text-[12px] font-semibold text-[#5C6773]">
              <input type="checkbox" className="accent-[#0891B2]" /> 로그인 유지
            </label>
            <a
              href="#"
              className="text-[12px] font-bold text-[#0891B2] hover:underline"
            >
              비밀번호를 잊으셨나요?
            </a>
          </div>
        )}

        {/* 제출 */}
        <button
          type="button"
          onClick={handleSubmit}
          className="w-full rounded-[10px] bg-[#00C9C8] py-3 text-[14.5px] font-extrabold text-white transition-colors hover:bg-[#0891B2]"
        >
          {isSignup ? "회원가입" : "로그인"}
        </button>

        {/* 구분선 */}
        <div className="my-[18px] flex items-center gap-3 text-[11.5px] font-semibold text-[#9AA4B0] before:h-px before:flex-1 before:bg-[#E4E8EE] after:h-px after:flex-1 after:bg-[#E4E8EE]">
          또는
        </div>

        {/* 구글 연동 (아직 연동 전) */}
        <button
          type="button"
          onClick={handleGoogle}
          className="flex w-full items-center justify-center gap-2 rounded-[10px] border border-[#E4E8EE] bg-white py-[11px] text-[13.5px] font-bold text-[#182430] transition-colors hover:bg-[#F5F7F9]"
        >
          <GoogleIcon />
          Google로 계속하기
        </button>

        {/* 하단 전환 링크 */}
        <p className="mt-5 text-center text-[12px] font-semibold text-[#9AA4B0]">
          {isSignup ? "이미 계정이 있으신가요? " : "아직 계정이 없으신가요? "}
          <button
            type="button"
            onClick={() => switchMode(isSignup ? "login" : "signup")}
            className="font-bold text-[#0891B2] hover:underline"
          >
            {isSignup ? "로그인" : "회원가입"}
          </button>
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.34A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.94H.96a9 9 0 0 0 0 8.12l3.01-2.34z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.94l3.01 2.34C4.68 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  );
}
