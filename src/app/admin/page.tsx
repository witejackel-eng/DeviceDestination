import type { Metadata } from "next";
import Link from "next/link";
import {
  AdminCard,
  AdminMetric,
  AdminNotConnected,
  AdminPage,
  AdminStatus,
  AdminTableScroll,
} from "@/components/admin-section";
import { getOverviewMetrics } from "@/data/admin-repository";
import { requireCapability } from "@/lib/authz";
import { formatPrice } from "@/lib/products";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  await requireCapability("admin.view", "/admin");
  const metrics = await getOverviewMetrics();

  return (
    <AdminPage
      title="Overview"
      description="Today's trading position, taken live from the orders and payments tables."
      actions={
        <>
          <Link href="/admin/products" className="button-secondary min-h-10 !py-2 text-sm">
            Products
          </Link>
          <Link href="/admin/orders" className="button-primary min-h-10 !py-2 text-sm">
            Pending orders
          </Link>
        </>
      }
    >
      {!metrics ? (
        <AdminNotConnected what="The dashboard" />
      ) : (
        <div className="grid gap-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <AdminMetric
              label="Paid orders today"
              value={String(metrics.ordersToday)}
              hint="Counted from midnight, paid status only"
            />
            <AdminMetric
              label="Revenue today"
              value={formatPrice(metrics.revenueTodayPaise)}
              hint="GST-inclusive, paid orders"
            />
            <AdminMetric label="Paid orders (all time)" value={String(metrics.paidOrders)} />
            <AdminMetric
              label="Awaiting dispatch"
              value={String(metrics.awaitingDispatch)}
              tone={metrics.awaitingDispatch > 0 ? "warning" : "default"}
            />
            <AdminMetric
              label="Failed payments"
              value={String(metrics.failedPayments)}
              tone={metrics.failedPayments > 0 ? "danger" : "default"}
            />
            <AdminMetric
              label="Low stock products"
              value={String(metrics.lowStockCount)}
              hint="5 units or fewer"
              tone={metrics.lowStockCount > 0 ? "warning" : "default"}
            />
          </div>

          <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
            <AdminCard title="Recent orders">
              {metrics.recentOrders.length === 0 ? (
                <p className="p-6 text-sm text-[var(--muted)]">No orders recorded yet.</p>
              ) : (
                <AdminTableScroll>
                  <thead>
                    <tr className="border-b border-[var(--line)] text-left text-xs uppercase tracking-[0.05em] text-[var(--muted)]">
                      <th className="px-5 py-2.5 font-bold">Order</th>
                      <th className="px-5 py-2.5 font-bold">Customer</th>
                      <th className="px-5 py-2.5 font-bold">Date</th>
                      <th className="px-5 py-2.5 text-right font-bold">Amount</th>
                      <th className="px-5 py-2.5 font-bold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.recentOrders.map((order) => (
                      <tr key={order.orderNumber} className="border-b border-[var(--line)]">
                        <td className="px-5 py-3">
                          <Link
                            href={`/admin/orders/${order.orderNumber}`}
                            className="font-bold underline"
                          >
                            {order.orderNumber}
                          </Link>
                        </td>
                        <td className="px-5 py-3">{order.customerName}</td>
                        <td className="px-5 py-3 text-[var(--muted)]">
                          {order.createdAt.toLocaleDateString("en-IN")}
                        </td>
                        <td className="px-5 py-3 text-right">
                          {formatPrice(order.totalInclGstPaise)}
                        </td>
                        <td className="px-5 py-3">
                          <AdminStatus status={order.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </AdminTableScroll>
              )}
            </AdminCard>

            <AdminCard title="Recent customers">
              {metrics.recentCustomers.length === 0 ? (
                <p className="p-6 text-sm text-[var(--muted)]">No customers recorded yet.</p>
              ) : (
                <ul className="divide-y divide-[var(--line)]">
                  {metrics.recentCustomers.map((customer) => (
                    <li key={customer.id} className="px-5 py-3">
                      <p className="font-semibold">{customer.name}</p>
                      <p className="text-xs text-[var(--muted)]">{customer.email}</p>
                    </li>
                  ))}
                </ul>
              )}
            </AdminCard>
          </div>
        </div>
      )}
    </AdminPage>
  );
}
