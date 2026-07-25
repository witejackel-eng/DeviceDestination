import type { Metadata } from "next";
import Link from "next/link";
import { CheckoutForm } from "@/components/checkout-form";
import { isAuthConfigured } from "@/lib/auth";
import { getSessionUser, requireUser } from "@/lib/authz";

export const metadata: Metadata = {
  title: "Secure checkout",
  robots: { index: false, follow: false },
};

// Session-dependent: never prerendered or cached across users.
export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  // Browsing, searching, comparing and building a cart never require an account.
  // Checkout does — this is the first and only gate.
  const user = isAuthConfigured() ? await requireUser("/checkout") : await getSessionUser();

  return (
    <div className="container-standard section-space !pt-14">
      <p className="eyebrow">Secure checkout</p>
      <h1 className="display-section mt-4">Complete your order.</h1>
      <p className="mt-5 max-w-2xl text-lg leading-8 text-[var(--muted)]">
        Product prices include GST. Installation is not included and is quoted separately.
      </p>

      {user ? (
        <p className="mt-6 inline-flex flex-wrap items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface)] px-4 py-2 text-sm">
          <span className="font-bold">Signed in as {user.email}</span>
          <Link href="/account" className="text-[var(--muted)] underline">
            Account
          </Link>
        </p>
      ) : (
        <p className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm leading-6">
          <strong>Authentication is not configured in this environment.</strong> In production
          customers sign in with Google before checkout; this preview accepts details directly so
          the order flow stays testable.
        </p>
      )}

      <div className="mt-10">
        <CheckoutForm
          defaultCustomer={{ name: user?.name ?? "", email: user?.email ?? "" }}
          signedIn={Boolean(user)}
        />
      </div>
    </div>
  );
}
