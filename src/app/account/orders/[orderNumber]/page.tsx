import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { getAuth, isAuthConfigured } from "@/lib/auth";
import { getOrderForUser } from "@/lib/account";
import { formatPrice } from "@/lib/products";

export const metadata: Metadata = { title: "Order detail", robots: { index: false, follow: false } };

type Params = Promise<{ orderNumber: string }>;

export default async function AccountOrderDetailPage({ params }: { params: Params }) {
  const { orderNumber } = await params;
  if (!isAuthConfigured()) redirect("/login");
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) redirect(`/login?next=/account/orders/${orderNumber}`);
  const data = await getOrderForUser(session.user.id, orderNumber);
  if (!data) notFound();
  const { order, items } = data;

  return (
    <div className="container-standard section-space !pt-14">
      <Link href="/account/orders" className="text-sm font-bold underline">
        ← Order history
      </Link>
      <p className="eyebrow mt-6">Account</p>
      <h1 className="display-section mt-2">{order.orderNumber}</h1>
      <p className="mt-4 text-[var(--text-muted)]">
        Status: <strong>{order.status.replaceAll("_", " ")}</strong> · Total:{" "}
        <strong>{formatPrice(order.totalInclGstPaise)}</strong>
      </p>

      <div className="surface-card mt-6 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--surface-muted)] text-left text-xs uppercase tracking-wide text-[var(--text-muted)]">
            <tr>
              <th className="p-3">Model</th>
              <th className="p-3">Title</th>
              <th className="p-3">Qty</th>
              <th className="p-3">Unit price</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {items.map((item) => (
              <tr key={item.id}>
                <td className="p-3 font-mono text-xs">{item.model}</td>
                <td className="p-3">{item.title}</td>
                <td className="p-3">{item.quantity}</td>
                <td className="p-3">{formatPrice(item.unitPriceInclGstPaise)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {order.invoiceNumber && (
        <p className="mt-4 text-sm">
          Invoice: <code className="text-xs">{order.invoiceNumber}</code>
        </p>
      )}
    </div>
  );
}
