import type { Metadata } from "next";
import Link from "next/link";
import {
  AdminCard,
  AdminNotConnected,
  AdminPage,
  AdminStatus,
  AdminTableScroll,
} from "@/components/admin-section";
import { listAdminOrders } from "@/data/admin-repository";
import { requireCapability } from "@/lib/authz";
import { formatPrice } from "@/lib/products";

export const metadata: Metadata = { title: "Orders", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  await requireCapability("orders.view", "/admin/orders");
  const rows = await listAdminOrders();

  return (
    <AdminPage
      title="Orders"
      description="Payment state comes from the verified Razorpay webhook. Fulfilment state is set here."
    >
      {!rows ? (
        <AdminNotConnected what="The order queue" />
      ) : rows.length === 0 ? (
        <AdminCard>
          <p className="p-8 text-center text-sm text-[var(--muted)]">No orders recorded yet.</p>
        </AdminCard>
      ) : (
        <AdminCard>
          <AdminTableScroll>
            <thead>
              <tr className="border-b border-[var(--line)] text-left text-xs uppercase tracking-[0.05em] text-[var(--muted)]">
                <th className="px-4 py-2.5 font-bold">Order</th>
                <th className="px-4 py-2.5 font-bold">Customer</th>
                <th className="px-4 py-2.5 font-bold">Date</th>
                <th className="px-4 py-2.5 text-right font-bold">Amount</th>
                <th className="px-4 py-2.5 font-bold">Payment</th>
                <th className="px-4 py-2.5 font-bold">Fulfilment</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-[var(--line)]">
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">
                    {row.orderNumber}
                  </td>
                  <td className="px-4 py-3">
                    <span className="block font-semibold">{row.customerName}</span>
                    <span className="block text-xs text-[var(--muted)]">{row.customerEmail}</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-[var(--muted)]">
                    {row.createdAt.toLocaleDateString("en-IN")}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    {formatPrice(row.totalInclGstPaise)}
                  </td>
                  <td className="px-4 py-3">
                    <AdminStatus status={row.paymentStatus ?? "pending"} />
                  </td>
                  <td className="px-4 py-3">
                    <AdminStatus status={row.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/orders/${row.orderNumber}`}
                      className="text-sm font-bold underline"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </AdminTableScroll>
        </AdminCard>
      )}
    </AdminPage>
  );
}
