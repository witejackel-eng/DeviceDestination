import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, MessageCircle, Package } from "lucide-react";
import { AccountShell, StatusPill } from "@/components/account-shell";
import { UnconfiguredAccountNotice } from "@/components/account-panel";
import { siteConfig } from "@/config/site";
import { listAddressesForUser, listOrdersForUser } from "@/data/orders-repository";
import { isAuthConfigured } from "@/lib/auth";
import { requireUser } from "@/lib/authz";
import { formatPrice } from "@/lib/products";

export const metadata: Metadata = { title: "Account", robots: { index: false, follow: false } };

// Session-dependent: never prerendered or cached across users.
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  if (!isAuthConfigured()) return <UnconfiguredAccountNotice />;
  const user = await requireUser("/account");
  const [orders, addresses] = await Promise.all([
    listOrdersForUser(user.id),
    listAddressesForUser(user.id),
  ]);
  const latest = orders[0];

  return (
    <AccountShell
      user={user}
      title="Account."
      description={`Signed in as ${user.email}.`}
    >
      <div className="grid gap-5">
        <section className="surface-card p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="font-display text-2xl font-semibold">Most recent order</h2>
            <Link href="/account/orders" className="text-sm font-bold underline">
              All orders
            </Link>
          </div>
          {latest ? (
            <div className="mt-5 rounded-[16px] border border-[var(--line)] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-display text-xl font-semibold">{latest.orderNumber}</p>
                  <p className="text-sm text-[var(--muted)]">
                    {latest.createdAt.toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}{" "}
                    · {latest.items.length} {latest.items.length === 1 ? "item" : "items"}
                  </p>
                </div>
                <StatusPill status={latest.status} />
              </div>
              <ul className="mt-4 grid gap-1 text-sm text-[var(--muted)]">
                {latest.items.map((item) => (
                  <li key={item.id}>
                    {item.model} × {item.quantity}
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <strong>{formatPrice(latest.totalInclGstPaise)}</strong>
                <Link
                  href={`/account/orders/${latest.orderNumber}`}
                  className="button-secondary min-h-11"
                >
                  View order <ArrowRight size={15} />
                </Link>
              </div>
            </div>
          ) : (
            <div className="mt-5 rounded-[16px] border border-dashed border-[var(--line)] p-8 text-center">
              <Package size={22} className="mx-auto text-[var(--muted)]" />
              <p className="mt-3 font-semibold">No orders yet.</p>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Orders placed with this account appear here with their GST invoice.
              </p>
              <Link href="/products" className="button-primary mt-5">
                Browse products
              </Link>
            </div>
          )}
        </section>

        <div className="grid gap-5 sm:grid-cols-2">
          <Link href="/account/addresses" className="surface-card p-6">
            <p className="eyebrow">Delivery</p>
            <h2 className="mt-3 font-display text-2xl font-semibold">Saved addresses</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {addresses.length === 0
                ? "No addresses saved yet."
                : `${addresses.length} saved ${addresses.length === 1 ? "address" : "addresses"}.`}
            </p>
          </Link>
          <a
            href={`https://wa.me/${siteConfig.contact.whatsapp}`}
            className="surface-card p-6"
            rel="noreferrer noopener"
            target="_blank"
          >
            <p className="eyebrow">Support</p>
            <h2 className="mt-3 flex items-center gap-2 font-display text-2xl font-semibold">
              <MessageCircle size={20} /> Order help
            </h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Message the team about delivery, invoices or compatibility.
            </p>
          </a>
        </div>
      </div>
    </AccountShell>
  );
}
