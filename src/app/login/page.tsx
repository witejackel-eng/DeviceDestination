import type { Metadata } from "next";
import { LoginForm } from "@/components/auth-forms";
export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: false } };
export default function LoginPage() {
  return (
    <div className="container-reading section-space !pt-14">
      <LoginForm />
    </div>
  );
}
