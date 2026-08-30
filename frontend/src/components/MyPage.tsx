"use client";

// ============================================================
// MyPage.tsx — 마이페이지 (프로필/이용 현황/로그아웃/회원탈퇴)
// ------------------------------------------------------------
// DiagnosisCards의 sheet 카드 스타일(흰 배경 + 얇은 테두리 + SheetHeader)을
// 그대로 재사용해서 다른 페이지들과 톤을 맞춤.
// 백엔드 PATCH/DELETE /auth/me는 아직 없음(유진 작업 예정) — 붙는 대로 바로 동작.
// ============================================================

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface UserInfo {
  id: number;
  email: string;
  nickname: string;
  /** 아직 백엔드에 없는 필드 — 값이 오면 이니셜 대신 실제 이미지로 표시 */
  avatar_url?: string | null;
  created_at: string;
}

interface HistoryItem {
  id: number;
  saved_tokens: number;
  saved_percent: number;
  created_at: string;
}

const AVATAR_COLORS = ["#00C9C8", "#0891B2", "#7C7CF0", "#E0A23C", "#D6746B", "#0B8564"];

function colorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function authHeaders(): HeadersInit {
  const token = localStorage.getItem("access_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function MyPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserInfo | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [nicknameDraft, setNicknameDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      router.push("/auth");
      return;
    }
    async function load() {
      try {
        const [meRes, historyRes] = await Promise.all([
          fetch(`${API_URL}/auth/me`, { headers: authHeaders() }),
          fetch(`${API_URL}/history`, { headers: authHeaders() }),
        ]);
        if (meRes.status === 401) {
          router.push("/auth");
          return;
        }
        if (!meRes.ok) throw new Error("failed to load /auth/me");
        const meData: UserInfo = await meRes.json();
        setUser(meData);
        setNicknameDraft(meData.nickname);
        if (historyRes.ok) setHistory(await historyRes.json());
      } catch {
        setLoadError("정보를 불러오지 못했어요. 잠시 후 다시 시도해주세요.");
      } finally {
        setLoading(false);
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveNickname() {
    const v = nicknameDraft.trim();
    if (v.length < 2 || v.length > 20) {
      setSaveError("닉네임은 2~20자 사이여야 해요.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`${API_URL}/auth/me`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ nickname: v }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveError(data.error ?? "저장에 실패했어요.");
        return;
      }
      setUser(data);
      setEditing(false);
    } catch {
      setSaveError("서버에 연결할 수 없어요.");
    } finally {
      setSaving(false);
    }
  }

  function logout() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    router.push("/");
  }

  async function deleteAccount() {
    setDeleting(true);
    try {
      await fetch(`${API_URL}/auth/me`, { method: "DELETE", headers: authHeaders() });
    } finally {
      // 서버 요청이 실패해도 로컬 토큰은 지우고 내보낸다 — 재로그인 시 서버가 다시 판단
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      router.push("/");
    }
  }

  if (loading) {
    return <p className="text-[13px] font-semibold text-[#9AA4B0]">불러오는 중…</p>;
  }
  if (loadError || !user) {
    return (
      <div className="rounded-xl border border-[#F5C2C4] bg-[#FDECEC] p-5 text-[12.5px] font-semibold text-[#E5484D]">
        {loadError ?? "정보를 불러오지 못했어요."}
      </div>
    );
  }

  const now = new Date();
  const thisMonthCount = history.filter((h) => {
    const d = new Date(h.created_at);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;
  const totalSavedTokens = history.reduce((sum, h) => sum + h.saved_tokens, 0);
  const avgSavedPercent = history.length
    ? Math.round(history.reduce((sum, h) => sum + h.saved_percent, 0) / history.length)
    : 0;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="mb-1.5 font-mono text-[11px] font-extrabold tracking-[.08em] text-[#0891B2] uppercase">
          마이페이지
        </div>
        <h1 className="text-[26px] font-extrabold tracking-tight text-[#182430]">내 계정</h1>
        <div className="mt-1 text-[12.5px] font-semibold text-[#9AA4B0]">프로필과 계정을 관리해요</div>
      </div>

      {/* 프로필 카드 */}
      <div className="flex items-center gap-4 rounded-xl border border-[#E4E8EE] bg-white p-5">
        <Avatar user={user} size={52} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-extrabold text-[#182430]">{user.nickname}</div>
          <div className="mt-0.5 truncate font-mono text-[12px] text-[#9AA4B0]">{user.email}</div>
        </div>
        <button
          onClick={() => {
            setEditing((v) => !v);
            setNicknameDraft(user.nickname);
            setSaveError(null);
          }}
          className="h-[34px] flex-none rounded-[9px] border border-[#E4E8EE] bg-white px-3.5 text-[12.5px] font-bold text-[#182430] hover:bg-[#F5F7F9]"
        >
          프로필 수정
        </button>
      </div>

      {editing && (
        <div className="rounded-xl border border-[#E4E8EE] bg-white p-5">
          <h3 className="mb-3.5 text-[12px] font-extrabold text-[#5C6773]">닉네임 변경</h3>
          <div className="mb-3.5 flex justify-center">
            <Avatar user={{ ...user, nickname: nicknameDraft || user.nickname }} size={52} />
          </div>
          <input
            value={nicknameDraft}
            onChange={(e) => setNicknameDraft(e.target.value)}
            maxLength={20}
            placeholder="닉네임 (2~20자)"
            className="w-full rounded-[9px] border border-[#E4E8EE] px-3 py-2 text-[13.5px] text-[#182430] outline-none focus:border-[#00C9C8]"
          />
          {saveError && <p className="mt-2 text-[11.5px] font-semibold text-[#E5484D]">{saveError}</p>}
          <div className="mt-3.5 flex gap-2">
            <button
              onClick={saveNickname}
              disabled={saving}
              className="h-[36px] rounded-[9px] bg-[#00C9C8] px-4 text-[12.5px] font-bold text-white hover:bg-[#0891B2] disabled:bg-[#D4D9E0]"
            >
              {saving ? "저장 중…" : "저장"}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="h-[36px] rounded-[9px] border border-[#E4E8EE] bg-white px-4 text-[12.5px] font-bold text-[#182430] hover:bg-[#F5F7F9]"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* 이용 현황 */}
      <div className="rounded-xl border border-[#E4E8EE] bg-white">
        <div className="border-b border-[#EEF1F4] px-5 py-3.5">
          <h2 className="text-[12.5px] font-extrabold text-[#5C6773]">이용 현황</h2>
        </div>
        <div className="flex divide-x divide-[#EEF1F4] px-5 py-4">
          <Stat n={thisMonthCount} label="이번 달 진단 횟수" />
          <Stat n={totalSavedTokens} label="누적 절감 토큰" />
          <Stat n={`${avgSavedPercent}%`} label="평균 절감률" />
        </div>
      </div>

      {/* 위험 영역 */}
      <div className="flex flex-col items-stretch gap-2.5 rounded-xl border border-[#E4E8EE] bg-white p-5">
        <button
          onClick={logout}
          className="h-[38px] w-full rounded-[9px] border border-[#E4E8EE] bg-white text-[12.5px] font-bold text-[#182430] hover:bg-[#F5F7F9]"
        >
          로그아웃
        </button>
        <button
          onClick={() => setConfirmingDelete(true)}
          className="text-center text-[12px] font-semibold text-[#9AA4B0] hover:text-[#E5484D]"
        >
          회원 탈퇴
        </button>
      </div>

      {confirmingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-6">
          <div className="w-full max-w-[360px] rounded-xl border border-[#E4E8EE] bg-white p-6">
            <h3 className="mb-2 text-[15px] font-extrabold text-[#182430]">정말 탈퇴하시겠어요?</h3>
            <p className="mb-5 text-[12.5px] leading-[1.6] font-semibold text-[#9AA4B0]">
              계정과 진단 기록에 다시 접근할 수 없게 돼요. 이 작업은 되돌릴 수 없어요.
            </p>
            <div className="flex gap-2">
              <button
                onClick={deleteAccount}
                disabled={deleting}
                className="h-[38px] flex-1 rounded-[9px] bg-[#E5484D] text-[12.5px] font-bold text-white hover:bg-[#C93D42] disabled:bg-[#D4D9E0]"
              >
                {deleting ? "처리 중…" : "탈퇴하기"}
              </button>
              <button
                onClick={() => setConfirmingDelete(false)}
                disabled={deleting}
                className="h-[38px] flex-1 rounded-[9px] border border-[#E4E8EE] bg-white text-[12.5px] font-bold text-[#182430] hover:bg-[#F5F7F9]"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Avatar({ user, size }: { user: UserInfo; size: number }) {
  if (user.avatar_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={user.avatar_url}
        alt={user.nickname}
        style={{ width: size, height: size }}
        className="flex-none rounded-full object-cover"
      />
    );
  }
  return (
    <div
      style={{ width: size, height: size, background: colorForName(user.nickname), fontSize: size * 0.36 }}
      className="flex flex-none items-center justify-center rounded-full font-extrabold text-white"
    >
      {user.nickname.slice(0, 1)}
    </div>
  );
}

function Stat({ n, label }: { n: number | string; label: string }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-1 px-2 text-center first:pl-0 last:pr-0">
      <span className="font-mono text-[19px] font-extrabold text-[#182430]">{n}</span>
      <span className="text-[11px] font-semibold text-[#9AA4B0]">{label}</span>
    </div>
  );
}
