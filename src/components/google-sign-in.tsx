"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

/**
 * The real Google OAuth handoff. Better Auth performs a full-page redirect to
 * Google, so nothing on this page ever sees a Google password, and the
 * localStorage cart survives the round trip untouched.
 */
export function GoogleSignInButton({
  next,
  label = "Continue with Google",
}: {
  next: string;
  label?: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  return (
    <div className="grid gap-3">
      <button
        type="button"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError("");
          const result = await authClient.signIn.social({
            provider: "google",
            callbackURL: next,
            errorCallbackURL: `/login?error=google&next=${encodeURIComponent(next)}`,
          });
          if (result?.error) {
            setPending(false);
            setError(result.error.message ?? "Google sign-in could not start. Please try again.");
          }
        }}
        className="flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-[var(--line)] bg-white px-4 font-bold text-[var(--ink)] transition-colors hover:border-[var(--tangerine-border-hover)] hover:bg-[var(--tangerine-subtle)] disabled:cursor-wait disabled:opacity-60"
      >
        <GoogleGlyph />
        {pending ? "Redirecting to Google…" : label}
      </button>
      {error && (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function GoogleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.81.54-1.84.86-3.05.86-2.35 0-4.34-1.58-5.05-3.71H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.95 10.71a5.4 5.4 0 0 1 0-3.42V4.96H.96a9 9 0 0 0 0 8.08l2.99-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l2.99 2.33C4.66 5.16 6.65 3.58 9 3.58Z"
      />
    </svg>
  );
}
