import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/db/client";
import {
  adminAuditLogs,
  enquiries,
  inventory,
  inventoryReservations,
  jobs,
  orders,
  products,
} from "@/db/schema";
import { requireAdmin } from "@/lib/admin-auth";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

type Stat = { label: string; href: string; count: number; tone: "default" | "warning" | "danger" };

async function getOperationalStats(): Promise<Stat[]> {
  if (!isDatabaseConfigured()) return [];
  const db = getDb();
  const [pendingPayment] = await db
    .select({ count: sql<number>`count(*)` })
    .from(orders)
    .where(eq(orders.status, "payment_pending"));
  const [paidAwaitingProcessing] = await db
    .select({ count: sql<number>`count(*)` })
    .from(orders)
    .where(eq(orders.status, "paid"));
  const [awaitingShipment] = await db
    .select({ count: sql<number>`count(*)` })
    .from(orders)
    .where(eq(orders.status, "processing"));
  const [lowStockRows] = await db
    .select({ count: sql<number>`count(*)` })
    .from(inventory)
    .where(sql`COALESCE(${inventory.quantityAvailable}, 0) - ${inventory.reserved} <= 3`);
  const [expiringReservations] = await db
    .select({ count: sql<number>`count(*)` })
    .from(inventoryReservations)
    .where(
      sql`${inventoryReservations.status} = 'active' AND ${inventoryReservations.expiresAt} < NOW() + INTERVAL '10 minutes'`,
    );
  const [stalePrices] = await db
    .select({ count: sql<number>`count(*)` })
    .from(products)
    .where(
      sql`${products.priceSourceStatus} != 'verified' OR ${products.priceVerifiedAt} IS NULL OR ${products.priceVerifiedAt} < NOW() - INTERVAL '30 days'`,
    );
  const [failedNotifications] = await db
    .select({ count: sql<number>`count(*)` })
    .from(orders)
    .where(sql`${orders.emailStatus} = 'failed' OR ${orders.whatsappStatus} = 'failed'`);
  const [newEnquiries] = await db
    .select({ count: sql<number>`count(*)` })
    .from(enquiries)
    .where(eq(enquiries.status, "new"));
  const [pendingJobs] = await db
    .select({ count: sql<number>`count(*)` })
    .from(jobs)
    .where(eq(jobs.status, "pending"));

  return [
    {
      label: "Orders awaiting payment",
      href: "/admin/orders?status=payment_pending",
      count: Number(pendingPayment?.count ?? 0),
      tone: "default",
    },
    {
      label: "Paid orders awaiting processing",
      href: "/admin/orders?status=paid",
      count: Number(paidAwaitingProcessing?.count ?? 0),
      tone: "default",
    },
    {
      label: "Orders awaiting shipment",
      href: "/admin/orders?status=processing",
      count: Number(awaitingShipment?.count ?? 0),
      tone: "default",
    },
    {
      label: "Low-stock products",
      href: "/admin/inventory?lowStock=1",
      count: Number(lowStockRows?.count ?? 0),
      tone: "warning",
    },
    {
      label: "Expiring inventory reservations",
      href: "/admin/inventory?tab=reservations",
      count: Number(expiringReservations?.count ?? 0),
      tone: "warning",
    },
    {
      label: "Stale product prices",
      href: "/admin/pricing?stale=1",
      count: Number(stalePrices?.count ?? 0),
      tone: "warning",
    },
    {
      label: "Failed notifications",
      href: "/admin/orders?notificationFailed=1",
      count: Number(failedNotifications?.count ?? 0),
      tone: "danger",
    },
    {
      label: "New enquiries",
      href: "/admin/enquiries?status=new",
      count: Number(newEnquiries?.count ?? 0),
      tone: "default",
    },
    {
      label: "Pending background jobs",
      href: "/admin/audit?tab=jobs",
      count: Number(pendingJobs?.count ?? 0),
      tone: "warning",
    },
  ];
}

async function getRecentAuditEvents() {
  if (!isDatabaseConfigured()) return [];
  const db = getDb();
  return db
    .select({
      id: adminAuditLogs.id,
      actorEmail: adminAuditLogs.actorEmail,
      action: adminAuditLogs.action,
      entityType: adminAuditLogs.entityType,
      entityId: adminAuditLogs.entityId,
      createdAt: adminAuditLogs.createdAt,
    })
    .from(adminAuditLogs)
    .orderBy(desc(adminAuditLogs.createdAt))
    .limit(10);
}

export default async function AdminPage() {
  await requireAdmin();
  const stats = await getOperationalStats();
  const recentAudit = await getRecentAuditEvents();
  return (
    <div className="container-standard section-space !pt-14">
      <p className="eyebrow">Protected operations</p>
      <h1 className="display-section mt-4">Admin.</h1>
      <section className="mt-10">
        <h2 className="font-display text-2xl font-semibold">Operational snapshot</h2>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Counts reflect real database state. No simulated figures.
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stats.length === 0 ? (
            <div className="surface-card col-span-full p-6 text-sm text-[var(--text-muted)]">
              Database is not configured — counts will appear here once a Neon connection is active.
            </div>
          ) : (
            stats.map((stat) => (
              <Link
                key={stat.label}
                href={stat.href}
                className={`surface-card flex flex-col gap-2 p-5 transition hover:-translate-y-0.5 ${
                  stat.tone === "danger"
                    ? "border-red-300"
                    : stat.tone === "warning"
                      ? "border-amber-300"
                      : ""
                }`}
              >
                <span className="font-display text-4xl font-semibold">{stat.count}</span>
                <span className="text-sm text-[var(--text-muted)]">{stat.label}</span>
              </Link>
            ))
          )}
        </div>
      </section>
      <section className="mt-12">
        <h2 className="font-display text-2xl font-semibold">Recent audit events</h2>
        {recentAudit.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--text-muted)]">
            No audit events recorded yet. Mutations on this dashboard will appear here.
          </p>
        ) : (
          <div className="surface-card mt-4 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[var(--surface-muted)] text-left text-xs uppercase tracking-wide text-[var(--text-muted)]">
                <tr>
                  <th className="p-3">When</th>
                  <th className="p-3">Actor</th>
                  <th className="p-3">Action</th>
                  <th className="p-3">Entity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {recentAudit.map((event) => (
                  <tr key={event.id}>
                    <td className="p-3 text-[var(--text-muted)]">
                      {new Date(event.createdAt).toLocaleString()}
                    </td>
                    <td className="p-3">{event.actorEmail ?? "—"}</td>
                    <td className="p-3 font-mono text-xs">{event.action}</td>
                    <td className="p-3 font-mono text-xs">
                      {event.entityType}:{event.entityId.slice(0, 8)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Products", "/admin/products", "Catalogue, assets and publication"],
          ["Orders", "/admin/orders", "Payment and fulfilment state"],
          ["Enquiries", "/admin/enquiries", "Contact, quote and installation requests"],
          ["Pricing", "/admin/pricing", "GST, source status and review warnings"],
          ["Inventory", "/admin/inventory", "Stock, reservations and adjustments"],
          ["Quotes", "/admin/quotes", "Quote lifecycle and conversion"],
          ["Audit", "/admin/audit", "All admin mutations"],
          ["Settings", "/admin/settings", "Operational settings and shipping"],
        ].map(([title, href, copy]) => (
          <Link key={href} href={href} className="surface-card p-5">
            <h3 className="font-display text-xl font-semibold">{title}</h3>
            <p className="mt-2 text-sm text-[var(--text-muted)]">{copy}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
