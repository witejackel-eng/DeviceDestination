import type { Metadata } from "next";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { AccountShell } from "@/components/account-shell";
import { UnconfiguredAccountNotice } from "@/components/account-panel";
import { listAddressesForUser } from "@/data/orders-repository";
import { isAuthConfigured } from "@/lib/auth";
import { requireUser } from "@/lib/authz";

export const metadata: Metadata = {
  title: "Saved addresses",
  robots: { index: false, follow: false },
};

// Session-dependent: never prerendered or cached across users.
export const dynamic = "force-dynamic";

export default async function AccountAddressesPage() {
  if (!isAuthConfigured()) return <UnconfiguredAccountNotice />;
  const user = await requireUser("/account/addresses");
  const addresses = await listAddressesForUser(user.id);

  return (
    <AccountShell
      user={user}
      title="Saved addresses."
      description="Addresses used on your previous orders. Choosing one at checkout saves re-typing it."
    >
      {addresses.length === 0 ? (
        <div className="surface-card grid place-items-center p-12 text-center">
          <MapPin size={26} className="text-[var(--muted)]" />
          <p className="mt-4 font-display text-2xl font-semibold">No saved addresses yet.</p>
          <p className="mt-2 max-w-md text-sm text-[var(--muted)]">
            The delivery address you enter at checkout is saved to your account automatically.
          </p>
          <Link href="/products" className="button-primary mt-6">
            Browse products
          </Link>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {addresses.map((address) => (
            <li key={address.id} className="surface-card p-6">
              {address.isDefault && (
                <span className="mb-3 inline-flex rounded-full bg-[var(--tangerine-soft)] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--tangerine-text)]">
                  Default
                </span>
              )}
              <address className="not-italic leading-7">
                <strong>{address.name}</strong>
                <br />
                {address.line1}
                {address.line2 && (
                  <>
                    <br />
                    {address.line2}
                  </>
                )}
                <br />
                {address.city}, {address.state} {address.pincode}
                <br />
                <span className="text-[var(--muted)]">{address.mobile}</span>
              </address>
              {address.instructions && (
                <p className="mt-3 rounded-xl bg-[var(--canvas-alt)] p-3 text-sm text-[var(--muted)]">
                  {address.instructions}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </AccountShell>
  );
}
