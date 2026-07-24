import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getQuoteForAdmin } from "@/app/admin/actions/quotes";
import { QuoteDetail } from "@/components/admin/quote-detail";
import { formatPrice } from "@/lib/products";

import { requireAdmin } from "@/lib/admin-auth";
export const metadata: Metadata = { title: "Admin · Quote", robots: { index: false, follow: false } };

type Params = Promise<{ id: string }>;

export default async function AdminQuoteDetailPage({ params }: { params: Params }) {
  await requireAdmin();
  const { id } = await params;
  const data = await getQuoteForAdmin(id);
  if (!data) notFound();
  const { quote, items, history } = data;
  return (
    <div className="container-standard section-space !pt-14">
      <Link href="/admin/quotes" className="text-sm font-bold underline">
        ← Quotes
      </Link>
      <p className="eyebrow mt-6">Operations</p>
      <h1 className="display-section mt-2">{quote.quoteNumber}</h1>
      <p className="mt-4 text-[var(--text-muted)]">
        Status: <strong>{quote.status}</strong> · Total:{" "}
        <strong>{formatPrice(quote.totalInclGstPaise)}</strong> · Expiry:{" "}
        {quote.expiryAt ? new Date(quote.expiryAt).toLocaleDateString() : "—"}
      </p>
      <div className="surface-card mt-8 p-6">
        <h2 className="font-display text-2xl font-semibold">Customer</h2>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[var(--text-muted)]">Name</dt>
            <dd className="mt-1">{quote.customerName}</dd>
          </div>
          <div>
            <dt className="text-[var(--text-muted)]">Email</dt>
            <dd className="mt-1 font-mono text-xs">{quote.customerEmail}</dd>
          </div>
          <div>
            <dt className="text-[var(--text-muted)]">Mobile</dt>
            <dd className="mt-1 font-mono text-xs">{quote.customerMobile}</dd>
          </div>
          {quote.customerBusinessName && (
            <div>
              <dt className="text-[var(--text-muted)]">Business</dt>
              <dd className="mt-1">{quote.customerBusinessName}</dd>
            </div>
          )}
        </dl>
      </div>
      <div className="surface-card mt-6 p-6">
        <h2 className="font-display text-2xl font-semibold">Items</h2>
        <table className="mt-3 w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-[var(--text-muted)]">
            <tr>
              <th className="p-2">Model</th>
              <th className="p-2">Title</th>
              <th className="p-2">Qty</th>
              <th className="p-2">Unit price</th>
              <th className="p-2">GST</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {items.map((item) => (
              <tr key={item.id}>
                <td className="p-2 font-mono text-xs">{item.model}</td>
                <td className="p-2">{item.title}</td>
                <td className="p-2">{item.quantity}</td>
                <td className="p-2">{formatPrice(item.unitPriceInclGstPaise)}</td>
                <td className="p-2 font-mono text-xs">{item.gstRateBasisPoints / 100}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="surface-card mt-6 p-6">
        <QuoteDetail quoteId={quote.id} currentStatus={quote.status} history={history} />
      </div>
    </div>
  );
}
