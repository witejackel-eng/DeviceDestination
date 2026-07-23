import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getAuth, isAuthConfigured } from "@/lib/auth";

export const metadata: Metadata = { title: "Account", robots: { index: false, follow: false } };

export default async function AccountPage() {
  if (isAuthConfigured()) {
    const session = await getAuth().api.getSession({ headers: await headers() });
    if (!session) redirect("/login?next=/account");
    return (
      <div className="container-standard section-space !pt-14">
        <p className="eyebrow">Your details</p>
        <h1 className="display-section mt-4">Account.</h1>
        <p className="mt-4 text-[var(--text-muted)]">
          Signed in as <strong>{session.user.email}</strong>.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Link href="/account/orders" className="surface-card p-6">
            <h2 className="font-display text-xl font-semibold">Orders</h2>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              View order history and claim guest orders by email.
            </p>
          </Link>
          <Link href="/account/addresses" className="surface-card p-6">
            <h2 className="font-display text-xl font-semibold">Addresses</h2>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              Manage saved delivery addresses.
            </p>
          </Link>
          <Link href="/account/profile" className="surface-card p-6">
            <h2 className="font-display text-xl font-semibold">Profile</h2>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              Update name and mobile. Email is read-only.
            </p>
          </Link>
        </div>
      </div>
    );
  }
  return (
    <div className="container-standard section-space !pt-14">
      <p className="eyebrow">Your details</p>
      <h1 className="display-section mt-4">Account.</h1>
      <div className="surface-card mt-10 p-8">
        <p className="font-display text-3xl font-semibold">
          Account features activate with production authentication.
        </p>
        <p className="mt-4 text-[var(--text-muted)]">
          Guest checkout and order-status lookups via secure confirmation links remain available.
        </p>
        <Link href="/products" className="button-primary mt-6">
          Continue shopping
        </Link>
      </div>
    </div>
  );
}
