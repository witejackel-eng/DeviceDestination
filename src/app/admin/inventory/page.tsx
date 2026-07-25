import type { Metadata } from "next";
import Link from "next/link";
import {
  AdminCard,
  AdminNotConnected,
  AdminPage,
  AdminStatus,
  AdminTableScroll,
} from "@/components/admin-section";
import { listAdminProducts } from "@/data/admin-repository";
import { requireCapability } from "@/lib/authz";

export const metadata: Metadata = { title: "Inventory", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const LOW_STOCK_THRESHOLD = 5;

export default async function AdminInventoryPage() {
  await requireCapability("inventory.manage", "/admin/inventory");
  const rows = await listAdminProducts();

  if (!rows)
    return (
      <AdminPage title="Inventory" description="Stock levels by exact model.">
        <AdminNotConnected what="Inventory" />
      </AdminPage>
    );

  // Lowest stock first so the queue reads as a work list, with untracked
  // products last rather than pretending they are out of stock.
  const ordered = [...rows].sort((a, b) => {
    const left = a.quantityAvailable ?? Number.POSITIVE_INFINITY;
    const right = b.quantityAvailable ?? Number.POSITIVE_INFINITY;
    return left - right;
  });
  const low = ordered.filter(
    (row) => row.quantityAvailable !== null && row.quantityAvailable <= LOW_STOCK_THRESHOLD,
  );

  return (
    <AdminPage
      title="Inventory"
      description={`${low.length} products at or below ${LOW_STOCK_THRESHOLD} units. Stock is edited on each product page.`}
    >
      <AdminCard>
        <AdminTableScroll>
          <thead>
            <tr className="border-b border-[var(--line)] text-left text-xs uppercase tracking-[0.05em] text-[var(--muted)]">
              <th className="px-4 py-2.5 font-bold">Model</th>
              <th className="px-4 py-2.5 font-bold">Product</th>
              <th className="px-4 py-2.5 font-bold">Availability</th>
              <th className="px-4 py-2.5 text-right font-bold">Units</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {ordered.map((row) => {
              const isLow =
                row.quantityAvailable !== null && row.quantityAvailable <= LOW_STOCK_THRESHOLD;
              return (
                <tr key={row.id} className="border-b border-[var(--line)]">
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">{row.model}</td>
                  <td className="px-4 py-3">
                    <span className="block max-w-[340px] truncate">{row.title}</span>
                  </td>
                  <td className="px-4 py-3">
                    <AdminStatus status={row.stockStatus} />
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-semibold ${isLow ? "text-[var(--danger)]" : ""}`}
                  >
                    {row.quantityAvailable ?? "Untracked"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/products/${row.id}`} className="text-sm font-bold underline">
                      Adjust
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </AdminTableScroll>
      </AdminCard>
    </AdminPage>
  );
}
