"use client";

import Link from "next/link";
import { authClient } from "@/lib/auth-client";

export function AccountPanel({ authConfigured }: { authConfigured: boolean }) {
  if (!authConfigured)
    return (
      <div className="surface-card p-8">
        <h2 className="font-display text-3xl font-semibold">
          Accounts activate with the production database.
        </h2>
        <p className="mt-4 leading-7 text-[var(--text-muted)]">
          Guest checkout is already available. Add the documented Better Auth and Neon variables to
          enable saved addresses, order history and session management.
        </p>
        <Link href="/products" className="button-primary mt-6">
          Continue as guest
        </Link>
      </div>
    );
  return <ConfiguredAccountPanel />;
}

function ConfiguredAccountPanel() {
  const { data: session, isPending } = authClient.useSession();
  if (isPending)
    return <div className="surface-card min-h-56 animate-pulse p-8" aria-label="Loading account" />;
  if (!session)
    return (
      <div className="surface-card p-8">
        <h2 className="font-display text-3xl font-semibold">Sign in to see saved details.</h2>
        <p className="mt-4 text-[var(--text-muted)]">You can still checkout without an account.</p>
        <div className="mt-6 flex gap-3">
          <Link href="/login" className="button-primary">
            Sign in
          </Link>
          <Link href="/signup" className="button-secondary">
            Create account
          </Link>
        </div>
      </div>
    );
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <div className="surface-card p-6">
        <p className="eyebrow">Profile</p>
        <h2 className="mt-4 font-display text-3xl font-semibold">{session.user.name}</h2>
        <p className="mt-2 text-[var(--text-muted)]">{session.user.email}</p>
      </div>
      <Link href="/account/orders" className="surface-card p-6">
        <p className="eyebrow">Orders</p>
        <h2 className="mt-4 font-display text-3xl font-semibold">Order history</h2>
        <p className="mt-2 text-[var(--text-muted)]">View paid and pending orders.</p>
      </Link>
      <Link href="/account/addresses" className="surface-card p-6">
        <p className="eyebrow">Delivery</p>
        <h2 className="mt-4 font-display text-3xl font-semibold">Saved addresses</h2>
      </Link>
      <button type="button" onClick={() => authClient.signOut()} className="button-secondary w-fit">
        Sign out
      </button>
    </div>
  );
}
