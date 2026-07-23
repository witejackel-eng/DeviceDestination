import type { Metadata } from "next";
import Link from "next/link";
import {
  listInventoryForAdmin,
  listInventoryAdjustmentsForAdmin,
  listReservationsForAdmin,
} from "@/app/admin/actions/inventory";
import { InventoryActions } from "@/components/admin/inventory-actions";

export const metadata: Metadata = { title: "Admin · Inventory", robots: { index: false, follow: false } };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminInventoryPage({ searchParams }: { searchParams: SearchParams }) {
  const query = await searchParams;
  const lowStockOnly = query.lowStock === "1";
  const tab = typeof query.tab === "string" ? query.tab : "stock";
  const inventoryResult = await listInventoryForAdmin({ lowStockOnly, page: 1, pageSize: 100 });
  const reservationsResult = await listReservationsForAdmin({ activeOnly: false, page: 1, pageSize: 50 });
  const adjustmentsResult = await listInventoryAdjustmentsForAdmin({ page: 1, pageSize: 25 });

  return (
    <div className="container-standard section-space !pt-14">
      <Link href="/admin" className="text-sm font-bold underline">
        ← Admin
      </Link>
      <p className="eyebrow mt-6">Operations</p>
      <h1 className="display-section mt-2">Inventory.</h1>
      <p className="mt-4 max-w-2xl text-[var(--text-muted)]">
        Every adjustment requires a quantity delta, reason and actor. Direct quantity overwrites are
        not permitted — use the adjustment form. Reservations are atomic and never produce negative
        stock.
      </p>

      <div className="mt-6 flex flex-wrap gap-2 text-sm">
        <Link
          href="/admin/inventory?tab=stock"
          className={`rounded-md border border-[var(--border)] px-3 py-1 ${tab === "stock" ? "bg-[var(--ink)] text-[var(--surface)]" : ""}`}
        >
          Stock
        </Link>
        <Link
          href="/admin/inventory?tab=reservations"
          className={`rounded-md border border-[var(--border)] px-3 py-1 ${tab === "reservations" ? "bg-[var(--ink)] text-[var(--surface)]" : ""}`}
        >
          Reservations
        </Link>
        <Link
          href="/admin/inventory?tab=adjustments"
          className={`rounded-md border border-[var(--border)] px-3 py-1 ${tab === "adjustments" ? "bg-[var(--ink)] text-[var(--surface)]" : ""}`}
        >
          Adjustment history
        </Link>
        <Link
          href="/admin/inventory?tab=new"
          className={`rounded-md border border-[var(--border)] px-3 py-1 ${tab === "new" ? "bg-[var(--ink)] text-[var(--surface)]" : ""}`}
        >
          New adjustment
        </Link>
      </div>

      {tab === "stock" && (
        <div className="surface-card mt-4 overflow-hidden">
          {inventoryResult.items.length === 0 ? (
            <p className="p-6 text-sm text-[var(--text-muted)]">
              No inventory rows. Add stock via the adjustment form.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-[var(--surface-muted)] text-left text-xs uppercase tracking-wide text-[var(--text-muted)]">
                <tr>
                  <th className="p-3">Model</th>
                  <th className="p-3">Available</th>
                  <th className="p-3">Reserved</th>
                  <th className="p-3">Sellable</th>
                  <th className="p-3">Stock status</th>
                  <th className="p-3">Lead time</th>
                  <th className="p-3">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {inventoryResult.items.map((row) => (
                  <tr key={row.productId} className={row.lowStock ? "bg-amber-50/40" : ""}>
                    <td className="p-3 font-mono text-xs">{row.model}</td>
                    <td className="p-3">{row.quantityAvailable ?? "—"}</td>
                    <td className="p-3">{row.reserved ?? 0}</td>
                    <td className="p-3 font-semibold">{row.sellable}</td>
                    <td className="p-3">{row.stockStatus.replaceAll("_", " ")}</td>
                    <td className="p-3">{row.leadTime ?? "—"}</td>
                    <td className="p-3 text-[var(--text-muted)]">
                      {new Date(row.updatedAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "reservations" && (
        <div className="surface-card mt-4 overflow-hidden">
          {reservationsResult.items.length === 0 ? (
            <p className="p-6 text-sm text-[var(--text-muted)]">No reservations recorded.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-[var(--surface-muted)] text-left text-xs uppercase tracking-wide text-[var(--text-muted)]">
                <tr>
                  <th className="p-3">Model</th>
                  <th className="p-3">Qty</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Expires</th>
                  <th className="p-3">Consumed</th>
                  <th className="p-3">Released</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {reservationsResult.items.map((r) => (
                  <tr key={r.id}>
                    <td className="p-3 font-mono text-xs">{r.model ?? r.productId.slice(0, 8)}</td>
                    <td className="p-3">{r.quantity}</td>
                    <td className="p-3">{r.status}</td>
                    <td className="p-3 text-[var(--text-muted)]">
                      {new Date(r.expiresAt).toLocaleString()}
                    </td>
                    <td className="p-3 text-[var(--text-muted)]">
                      {r.consumedAt ? new Date(r.consumedAt).toLocaleString() : "—"}
                    </td>
                    <td className="p-3 text-[var(--text-muted)]">
                      {r.releasedAt ? new Date(r.releasedAt).toLocaleString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "adjustments" && (
        <div className="surface-card mt-4 overflow-hidden">
          {adjustmentsResult.items.length === 0 ? (
            <p className="p-6 text-sm text-[var(--text-muted)]">No adjustments recorded.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-[var(--surface-muted)] text-left text-xs uppercase tracking-wide text-[var(--text-muted)]">
                <tr>
                  <th className="p-3">When</th>
                  <th className="p-3">Model</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Delta</th>
                  <th className="p-3">Before</th>
                  <th className="p-3">After</th>
                  <th className="p-3">Reason</th>
                  <th className="p-3">Actor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {adjustmentsResult.items.map((row) => (
                  <tr key={row.id}>
                    <td className="p-3 text-[var(--text-muted)]">
                      {new Date(row.createdAt).toLocaleString()}
                    </td>
                    <td className="p-3 font-mono text-xs">{row.model ?? "—"}</td>
                    <td className="p-3 font-mono text-xs">{row.type}</td>
                    <td className="p-3">{row.delta > 0 ? `+${row.delta}` : row.delta}</td>
                    <td className="p-3">{row.quantityBefore ?? "—"}</td>
                    <td className="p-3">{row.quantityAfter ?? "—"}</td>
                    <td className="p-3">{row.reason}</td>
                    <td className="p-3 text-xs">{row.actorEmail ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "new" && <InventoryActions products={inventoryResult.items} />}
    </div>
  );
}
