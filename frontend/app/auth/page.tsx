// app/auth/page.tsx
// 로그인/회원가입 (탭 전환). 실제 폼은 AuthForm 컴포넌트가 담당.
//
// ⚠ import 경로 주의:
//   너의 tsconfig는 "@/*": ["./*"] (루트 기준).
//   AuthForm.tsx를 src/components/에 두면  → "@/src/components/AuthForm"
//   AuthForm.tsx를 루트 components/에 두면 → "@/components/AuthForm"
//   기존 다른 컴포넌트(Header 등)를 import하는 방식과 똑같이 맞추면 됨.

import AuthForm from "@/src/components/AuthForm";

export default function AuthPage() {
  return <AuthForm />;
}
