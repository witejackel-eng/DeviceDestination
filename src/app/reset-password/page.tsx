import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/reset-password-form";
export default function ResetPasswordPage() {
  return (
    <div className="container-reading section-space !pt-14">
      <Suspense fallback={<div className="surface-card min-h-80 animate-pulse" />}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
