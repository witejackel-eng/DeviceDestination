import type { Metadata } from "next";
import { SignupForm } from "@/components/auth-forms";
export const metadata: Metadata = {
  title: "Create account",
  robots: { index: false, follow: false },
};
export default function SignupPage() {
  return (
    <div className="container-reading section-space !pt-14">
      <SignupForm />
    </div>
  );
}
