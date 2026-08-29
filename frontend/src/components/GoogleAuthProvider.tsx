"use client";

import { GoogleOAuthProvider } from "@react-oauth/google";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

export default function GoogleAuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // 클라이언트 ID가 없으면(환경변수 누락) 구글 로그인만 빠진 채로 앱은 정상 동작
  if (!GOOGLE_CLIENT_ID) {
    return <>{children}</>;
  }
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      {children}
    </GoogleOAuthProvider>
  );
}
