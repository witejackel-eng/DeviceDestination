import type { Metadata } from "next";
import {
  AdminCard,
  AdminNotConnected,
  AdminPage,
  AdminTableScroll,
} from "@/components/admin-section";
import { listAdminCustomers } from "@/data/admin-repository";
import { requireCapability } from "@/lib/authz";
import { formatPrice } from "@/lib/products";

export const metadata: Metadata = { title: "Customers", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminCustomersPage() {
  await requireCapability("customers.view", "/admin/customers");
  const rows = await listAdminCustomers();

  return (
    <AdminPage
      title="Customers"
      description="Order and spend history. OAuth tokens and provider identifiers are never surfaced here."
    >
      {!rows ? (
        <AdminNotConnected what="The customer list" />
      ) : rows.length === 0 ? (
        <AdminCard>
          <p className="p-8 text-center text-sm text-[var(--muted)]">No customers recorded yet.</p>
        </AdminCard>
      ) : (
        <AdminCard>
          <AdminTableScroll>
            <thead>
              <tr className="border-b border-[var(--line)] text-left text-xs uppercase tracking-[0.05em] text-[var(--muted)]">
                <th className="px-4 py-2.5 font-bold">Customer</th>
                <th className="px-4 py-2.5 font-bold">Contact</th>
                <th className="px-4 py-2.5 font-bold">Business</th>
                <th className="px-4 py-2.5 text-right font-bold">Orders</th>
                <th className="px-4 py-2.5 text-right font-bold">Paid spend</th>
                <th className="px-4 py-2.5 font-bold">Last order</th>
                <th className="px-4 py-2.5 font-bold">Account</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-[var(--line)]">
                  <td className="px-4 py-3 font-semibold">{row.name}</td>
                  <td className="px-4 py-3">
                    <span className="block text-[var(--muted)]">{row.email}</span>
                    <span className="block text-xs text-[var(--muted)]">{row.mobile}</span>
                  </td>
                  <td className="px-4 py-3">
                    {row.businessName ?? "—"}
                    {row.gstin && (
                      <span className="block font-mono text-xs text-[var(--muted)]">
                        {row.gstin}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">{Number(row.orderCount)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    {formatPrice(Number(row.totalSpendPaise))}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-[var(--muted)]">
                    {row.lastOrderAt ? new Date(row.lastOrderAt).toLocaleDateString("en-IN") : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--muted)]">
                    {row.userId ? "Signed-in" : "Guest record"}
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
