import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getAuth, isAuthConfigured } from "@/lib/auth";
import { listOrdersForUser } from "@/lib/account";
import { formatPrice } from "@/lib/products";

export const metadata: Metadata = { title: "Order history", robots: { index: false, follow: false } };

export default async function AccountOrdersPage() {
  if (!isAuthConfigured()) {
    return (
      <div className="container-standard section-space !pt-14">
        <p className="eyebrow">Account</p>
        <h1 className="display-section mt-4">Order history.</h1>
        <div className="surface-card mt-10 p-8">
          <p className="font-display text-3xl font-semibold">
            Order history activates with production authentication.
          </p>
          <p className="mt-4 text-[var(--text-muted)]">
            Guest orders remain accessible through the secure confirmation link.
          </p>
          <Link href="/products" className="button-primary mt-6">
            Continue shopping
          </Link>
        </div>
      </div>
    );
  }
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) redirect("/login?next=/account/orders");
  const result = await listOrdersForUser({ userId: session.user.id, page: 1, pageSize: 25 });

  return (
    <div className="container-standard section-space !pt-14">
      <Link href="/account" className="text-sm font-bold underline">
        ← Account
      </Link>
      <p className="eyebrow mt-6">Account</p>
      <h1 className="display-section mt-2">Order history.</h1>
      <div className="surface-card mt-6 overflow-hidden">
        {result.orders.length === 0 ? (
          <div className="p-6">
            <p className="font-display text-xl font-semibold">No orders yet.</p>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              Past guest orders linked to <code>{session.user.email}</code> can be claimed below.
            </p>
            <form action="/api/account/orders/claim" method="POST" className="mt-4">
              <button type="submit" className="button-secondary">
                Claim guest orders by email
              </button>
            </form>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[var(--surface-muted)] text-left text-xs uppercase tracking-wide text-[var(--text-muted)]">
              <tr>
                <th className="p-3">Order #</th>
                <th className="p-3">Status</th>
                <th className="p-3">Total</th>
                <th className="p-3">Invoice</th>
                <th className="p-3">Placed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {result.orders.map((row) => (
                <tr key={row.id} className="hover:bg-[var(--surface-muted)]">
                  <td className="p-3 font-mono text-xs">
                    <Link href={`/account/orders/${row.orderNumber}`} className="underline">
                      {row.orderNumber}
                    </Link>
                  </td>
                  <td className="p-3">{row.status.replaceAll("_", " ")}</td>
                  <td className="p-3">{formatPrice(row.totalInclGstPaise)}</td>
                  <td className="p-3 text-xs">{row.invoiceNumber ?? "—"}</td>
                  <td className="p-3 text-[var(--text-muted)]">
                    {new Date(row.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
