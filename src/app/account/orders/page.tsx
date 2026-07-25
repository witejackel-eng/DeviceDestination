import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Package } from "lucide-react";
import { AccountShell, StatusPill } from "@/components/account-shell";
import { UnconfiguredAccountNotice } from "@/components/account-panel";
import { listOrdersForUser } from "@/data/orders-repository";
import { isAuthConfigured } from "@/lib/auth";
import { requireUser } from "@/lib/authz";
import { formatPrice } from "@/lib/products";

export const metadata: Metadata = {
  title: "Order history",
  robots: { index: false, follow: false },
};

// Session-dependent: never prerendered or cached across users.
export const dynamic = "force-dynamic";

export default async function AccountOrdersPage() {
  if (!isAuthConfigured()) return <UnconfiguredAccountNotice />;
  const user = await requireUser("/account/orders");
  const orders = await listOrdersForUser(user.id);

  return (
    <AccountShell
      user={user}
      title="My orders."
      description="Every order placed with this account, with its payment state and GST invoice."
    >
      {orders.length === 0 ? (
        <div className="surface-card grid place-items-center p-12 text-center">
          <Package size={26} className="text-[var(--muted)]" />
          <p className="mt-4 font-display text-2xl font-semibold">No orders yet.</p>
          <p className="mt-2 max-w-md text-sm text-[var(--muted)]">
            Orders placed before you signed in remain reachable through the secure confirmation link
            emailed at checkout.
          </p>
          <Link href="/products" className="button-primary mt-6">
            Browse products
          </Link>
        </div>
      ) : (
        <ul className="grid gap-4">
          {orders.map((order) => (
            <li key={order.id} className="surface-card p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-display text-2xl font-semibold">{order.orderNumber}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {order.createdAt.toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <StatusPill status={order.status} />
              </div>
              <ul className="mt-4 grid gap-1.5 border-t border-[var(--line)] pt-4 text-sm">
                {order.items.map((item) => (
                  <li key={item.id} className="flex flex-wrap justify-between gap-2">
                    <span>
                      <strong className="text-[var(--tangerine-text)]">{item.model}</strong>{" "}
                      <span className="text-[var(--muted)]">× {item.quantity}</span>
                    </span>
                    <span>{formatPrice(item.unitPriceInclGstPaise * item.quantity)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-4">
                <span>
                  <strong className="text-lg">{formatPrice(order.totalInclGstPaise)}</strong>{" "}
                  <span className="text-xs text-[var(--muted)]">
                    incl. {formatPrice(order.includedGstPaise)} GST
                  </span>
                </span>
                <Link
                  href={`/account/orders/${order.orderNumber}`}
                  className="button-secondary min-h-11"
                >
                  Order details <ArrowRight size={15} />
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </AccountShell>
  );
}
