"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
export function ResetPasswordForm() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  return (
    <form
      className="surface-card grid gap-5 p-8"
      onSubmit={async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const password = String(data.get("password"));
        const result = await authClient.resetPassword({ newPassword: password, token });
        if (result.error) {
          setError(result.error.message ?? "Reset failed.");
          return;
        }
        setMessage("Password updated. You can now sign in.");
      }}
    >
      <h1 className="font-display text-4xl font-semibold">Choose a new password</h1>
      <label className="grid gap-2 text-sm font-bold">
        New password
        <input
          name="password"
          type="password"
          minLength={10}
          required
          autoComplete="new-password"
          className="h-12 rounded-xl border border-[var(--line)] px-3"
        />
      </label>
      {message && <p className="text-[var(--success)]">{message}</p>}
      {error && <p className="text-[var(--danger)]">{error}</p>}
      <button className="button-primary">Update password</button>
    </form>
  );
}
