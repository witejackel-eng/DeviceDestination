import type { Metadata } from "next";
import Link from "next/link";
import { listQuotesForAdmin } from "@/app/admin/actions/quotes";
import { formatPrice } from "@/lib/products";
import { QuoteCreateForm } from "@/components/admin/quote-create-form";

import { requireAdmin } from "@/lib/admin-auth";
export const metadata: Metadata = { title: "Admin · Quotes", robots: { index: false, follow: false } };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminQuotesPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin();
  const query = await searchParams;
  const status = (typeof query.status === "string" ? query.status : "all") as
    | "draft"
    | "sent"
    | "accepted"
    | "rejected"
    | "expired"
    | "converted"
    | "all";
  const showNew = query.new === "1";
  const result = await listQuotesForAdmin({ status, page: 1, pageSize: 25 });

  return (
    <div className="container-standard section-space !pt-14">
      <Link href="/admin" className="text-sm font-bold underline">
        ← Admin
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow mt-6">Operations</p>
          <h1 className="display-section mt-2">Quotes.</h1>
        </div>
        <Link href="/admin/quotes?new=1" className="button-primary">
          New quote
        </Link>
      </div>

      {showNew && (
        <div className="surface-card mt-6 p-6">
          <QuoteCreateForm />
        </div>
      )}

      <form className="surface-card mt-6 p-4">
        <label className="text-sm">
          <span className="block text-[var(--text-muted)]">Status</span>
          <select
            name="status"
            defaultValue={status}
            className="mt-1 h-11 w-full rounded-[var(--radius-btn)] border border-[var(--border)] bg-[var(--surface)] px-3"
          >
            <option value="all">All</option>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="accepted">Accepted</option>
            <option value="rejected">Rejected</option>
            <option value="expired">Expired</option>
            <option value="converted">Converted</option>
          </select>
        </label>
        <button type="submit" className="button-primary mt-3">Apply</button>
      </form>

      <div className="surface-card mt-4 overflow-hidden">
        {result.items.length === 0 ? (
          <p className="p-6 text-sm text-[var(--text-muted)]">No quotes recorded.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[var(--surface-muted)] text-left text-xs uppercase tracking-wide text-[var(--text-muted)]">
              <tr>
                <th className="p-3">Quote #</th>
                <th className="p-3">Customer</th>
                <th className="p-3">Status</th>
                <th className="p-3">Total</th>
                <th className="p-3">Expiry</th>
                <th className="p-3">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {result.items.map((row) => (
                <tr key={row.id} className="hover:bg-[var(--surface-muted)]">
                  <td className="p-3 font-mono text-xs">
                    <Link href={`/admin/quotes/${row.id}`} className="underline">
                      {row.quoteNumber}
                    </Link>
                  </td>
                  <td className="p-3">{row.customerName}</td>
                  <td className="p-3">{row.status}</td>
                  <td className="p-3">{formatPrice(row.totalInclGstPaise)}</td>
                  <td className="p-3 text-[var(--text-muted)]">
                    {row.expiryAt ? new Date(row.expiryAt).toLocaleDateString() : "—"}
                  </td>
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
