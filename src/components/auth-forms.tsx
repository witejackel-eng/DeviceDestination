"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

const input = "h-12 w-full rounded-xl border border-[var(--line)] bg-white px-3";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  return (
    <form
      className="surface-card grid gap-5 p-6 sm:p-8"
      onSubmit={async (event) => {
        event.preventDefault();
        setLoading(true);
        setError("");
        const data = new FormData(event.currentTarget);
        const result = await authClient.signIn.email({
          email: String(data.get("email")),
          password: String(data.get("password")),
        });
        setLoading(false);
        if (result.error) {
          setError(result.error.message ?? "Sign in failed.");
          return;
        }
        router.push("/account");
        router.refresh();
      }}
    >
      <h1 className="font-display text-4xl font-semibold">Sign in</h1>
      <label className="grid gap-2 text-sm font-bold">
        Email
        <input name="email" type="email" autoComplete="email" required className={input} />
      </label>
      <label className="grid gap-2 text-sm font-bold">
        Password
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          minLength={10}
          className={input}
        />
      </label>
      {error && (
        <p className="rounded-xl bg-red-50 p-4 text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      )}
      <button className="button-primary w-full" disabled={loading}>
        {loading ? "Signing in…" : "Sign in"}
      </button>
      <div className="flex flex-wrap justify-between gap-3 text-sm">
        <Link href="/forgot-password" className="underline">
          Forgot password?
        </Link>
        <Link href="/signup" className="underline">
          Create account
        </Link>
      </div>
    </form>
  );
}

export function SignupForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  return (
    <form
      className="surface-card grid gap-5 p-6 sm:p-8"
      onSubmit={async (event) => {
        event.preventDefault();
        setLoading(true);
        setError("");
        const data = new FormData(event.currentTarget);
        const result = await authClient.signUp.email({
          name: String(data.get("name")),
          email: String(data.get("email")),
          password: String(data.get("password")),
        });
        setLoading(false);
        if (result.error) {
          setError(result.error.message ?? "Account creation failed.");
          return;
        }
        router.push("/account");
        router.refresh();
      }}
    >
      <h1 className="font-display text-4xl font-semibold">Create account</h1>
      <p className="text-sm leading-6 text-[var(--muted)]">
        Accounts are optional. Guest checkout remains available.
      </p>
      <label className="grid gap-2 text-sm font-bold">
        Name
        <input name="name" autoComplete="name" required minLength={2} className={input} />
      </label>
      <label className="grid gap-2 text-sm font-bold">
        Email
        <input name="email" type="email" autoComplete="email" required className={input} />
      </label>
      <label className="grid gap-2 text-sm font-bold">
        Password
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          className={input}
        />
      </label>
      {error && (
        <p className="rounded-xl bg-red-50 p-4 text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      )}
      <button className="button-primary w-full" disabled={loading}>
        {loading ? "Creating…" : "Create account"}
      </button>
      <Link href="/login" className="text-center text-sm underline">
        Already have an account?
      </Link>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  return (
    <form
      className="surface-card grid gap-5 p-6 sm:p-8"
      onSubmit={async (event) => {
        event.preventDefault();
        setLoading(true);
        setError("");
        const data = new FormData(event.currentTarget);
        const result = await authClient.requestPasswordReset({
          email: String(data.get("email")),
          redirectTo: "/reset-password",
        });
        setLoading(false);
        if (result.error) {
          setError(result.error.message ?? "Reset request failed.");
          return;
        }
        setMessage("If that email has an account, a reset link has been sent.");
      }}
    >
      <h1 className="font-display text-4xl font-semibold">Reset password</h1>
      <label className="grid gap-2 text-sm font-bold">
        Email
        <input name="email" type="email" autoComplete="email" required className={input} />
      </label>
      {message && (
        <p className="rounded-xl bg-green-50 p-4 text-sm text-[var(--success)]" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="rounded-xl bg-red-50 p-4 text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      )}
      <button className="button-primary w-full" disabled={loading}>
        {loading ? "Sending…" : "Send reset link"}
      </button>
      <Link href="/login" className="text-center text-sm underline">
        Back to sign in
      </Link>
    </form>
  );
}
