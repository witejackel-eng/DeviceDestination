import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth-forms";
export const metadata: Metadata = {
  title: "Reset password",
  robots: { index: false, follow: false },
};
export default function ForgotPasswordPage() {
  return (
    <div className="container-reading section-space !pt-14">
      <ForgotPasswordForm />
    </div>
  );
}
