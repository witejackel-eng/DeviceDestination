import type { Metadata } from "next";
import Link from "next/link";
import { listOrdersForAdmin } from "@/app/admin/actions/orders";
import { formatPrice } from "@/lib/products";

import { requireAdmin } from "@/lib/admin-auth";
export const metadata: Metadata = { title: "Admin · Orders", robots: { index: false, follow: false } };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminOrdersPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin();
  const query = await searchParams;
  const status = (typeof query.status === "string" ? query.status : "all") as
    | "pending"
    | "payment_pending"
    | "paid"
    | "processing"
    | "shipped"
    | "delivered"
    | "cancelled"
    | "refund_pending"
    | "refunded"
    | "all";
  const notificationFailed = query.notificationFailed === "1";
  const page = Number(query.page ?? "1");
  const result = await listOrdersForAdmin({ status, notificationFailure: notificationFailed, page, pageSize: 25 });

  return (
    <div className="container-standard section-space !pt-14">
      <Link href="/admin" className="text-sm font-bold underline">
        ← Admin
      </Link>
      <p className="eyebrow mt-6">Operations</p>
      <h1 className="display-section mt-2">Orders.</h1>

      <form className="surface-card mt-6 grid gap-3 p-5 sm:grid-cols-3">
        <label className="text-sm">
          <span className="block text-[var(--text-muted)]">Status</span>
          <select
            name="status"
            defaultValue={status}
            className="mt-1 h-11 w-full rounded-[var(--radius-btn)] border border-[var(--border)] bg-[var(--surface)] px-3"
          >
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="payment_pending">Payment pending</option>
            <option value="paid">Paid</option>
            <option value="processing">Processing</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
            <option value="refund_pending">Refund pending</option>
            <option value="refunded">Refunded</option>
          </select>
        </label>
        <label className="flex items-end gap-2 text-sm">
          <input type="checkbox" name="notificationFailed" value="1" defaultChecked={notificationFailed} className="h-4 w-4" />
          <span>Notification failures only</span>
        </label>
        <button type="submit" className="button-primary">Apply filter</button>
      </form>

      <div className="surface-card mt-6 overflow-hidden">
        {result.items.length === 0 ? (
          <p className="p-6 text-sm text-[var(--text-muted)]">No orders match the current filter.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[var(--surface-muted)] text-left text-xs uppercase tracking-wide text-[var(--text-muted)]">
              <tr>
                <th className="p-3">Order #</th>
                <th className="p-3">Customer</th>
                <th className="p-3">Mobile</th>
                <th className="p-3">Status</th>
                <th className="p-3">Total</th>
                <th className="p-3">Notifications</th>
                <th className="p-3">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {result.items.map((row) => (
                <tr key={row.id} className="hover:bg-[var(--surface-muted)]">
                  <td className="p-3 font-mono text-xs">
                    <Link href={`/admin/orders/${row.id}`} className="underline">
                      {row.orderNumber}
                    </Link>
                  </td>
                  <td className="p-3">{row.customerName}</td>
                  <td className="p-3 font-mono text-xs">{row.customerMobile}</td>
                  <td className="p-3">{row.status.replaceAll("_", " ")}</td>
                  <td className="p-3">{formatPrice(row.totalInclGstPaise)}</td>
                  <td className="p-3 text-xs">
                    <span className={row.emailStatus === "failed" ? "text-red-700" : ""}>
                      email:{row.emailStatus}
                    </span>
                    <br />
                    <span className={row.whatsappStatus === "failed" ? "text-red-700" : ""}>
                      wa:{row.whatsappStatus}
                    </span>
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
