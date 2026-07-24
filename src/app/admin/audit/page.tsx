import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq, ilike, sql } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/db/client";
import { adminAuditLogs, jobs } from "@/db/schema";

import { requireAdmin } from "@/lib/admin-auth";
export const metadata: Metadata = { title: "Admin · Audit", robots: { index: false, follow: false } };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminAuditPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin();
  const query = await searchParams;
  const tab = typeof query.tab === "string" ? query.tab : "audit";
  const action = typeof query.action === "string" ? query.action : "";
  const entityType = typeof query.entityType === "string" ? query.entityType : "";
  const page = Number(query.page ?? "1");

  let auditRows: Array<{
    id: string;
    actorEmail: string | null;
    action: string;
    entityType: string;
    entityId: string;
    createdAt: Date;
  }> = [];
  let jobRows: Array<{
    id: string;
    type: string;
    status: string;
    attempts: number;
    maxAttempts: number;
    runAfter: Date;
    lastError: string | null;
    createdAt: Date;
  }> = [];

  if (isDatabaseConfigured()) {
    const db = getDb();
    const conditions = [];
    if (action) conditions.push(ilike(adminAuditLogs.action, `%${action}%`));
    if (entityType) conditions.push(eq(adminAuditLogs.entityType, entityType));
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    auditRows = await db
      .select({
        id: adminAuditLogs.id,
        actorEmail: adminAuditLogs.actorEmail,
        action: adminAuditLogs.action,
        entityType: adminAuditLogs.entityType,
        entityId: adminAuditLogs.entityId,
        createdAt: adminAuditLogs.createdAt,
      })
      .from(adminAuditLogs)
      .where(where)
      .orderBy(desc(adminAuditLogs.createdAt))
      .limit(100)
      .offset((page - 1) * 100);

    jobRows = await db
      .select({
        id: jobs.id,
        type: jobs.type,
        status: jobs.status,
        attempts: jobs.attempts,
        maxAttempts: jobs.maxAttempts,
        runAfter: jobs.runAfter,
        lastError: jobs.lastError,
        createdAt: jobs.createdAt,
      })
      .from(jobs)
      .orderBy(desc(jobs.createdAt))
      .limit(100);
  }

  return (
    <div className="container-standard section-space !pt-14">
      <Link href="/admin" className="text-sm font-bold underline">
        ← Admin
      </Link>
      <p className="eyebrow mt-6">Operations</p>
      <h1 className="display-section mt-2">Audit & jobs.</h1>

      <div className="mt-6 flex flex-wrap gap-2 text-sm">
        <Link
          href="/admin/audit?tab=audit"
          className={`rounded-md border border-[var(--border)] px-3 py-1 ${tab === "audit" ? "bg-[var(--ink)] text-[var(--surface)]" : ""}`}
        >
          Audit log
        </Link>
        <Link
          href="/admin/audit?tab=jobs"
          className={`rounded-md border border-[var(--border)] px-3 py-1 ${tab === "jobs" ? "bg-[var(--ink)] text-[var(--surface)]" : ""}`}
        >
          Background jobs
        </Link>
      </div>

      {tab === "audit" && (
        <div className="surface-card mt-4 overflow-hidden">
          <form className="grid gap-3 p-4 sm:grid-cols-3">
            <input
              name="action"
              defaultValue={action}
              placeholder="Action contains"
              className="h-11 rounded-[var(--radius-btn)] border border-[var(--border)] bg-[var(--surface)] px-3"
            />
            <input
              name="entityType"
              defaultValue={entityType}
              placeholder="Entity type"
              className="h-11 rounded-[var(--radius-btn)] border border-[var(--border)] bg-[var(--surface)] px-3"
            />
            <button type="submit" className="button-primary">Filter audit</button>
          </form>
          {auditRows.length === 0 ? (
            <p className="p-6 text-sm text-[var(--text-muted)]">No audit entries match.</p>
          ) : (
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
                {auditRows.map((row) => (
                  <tr key={row.id}>
                    <td className="p-3 text-[var(--text-muted)]">
                      {new Date(row.createdAt).toLocaleString()}
                    </td>
                    <td className="p-3 text-xs">{row.actorEmail ?? "—"}</td>
                    <td className="p-3 font-mono text-xs">{row.action}</td>
                    <td className="p-3 font-mono text-xs">
                      {row.entityType}:{row.entityId.slice(0, 8)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "jobs" && (
        <div className="surface-card mt-4 overflow-hidden">
          {jobRows.length === 0 ? (
            <p className="p-6 text-sm text-[var(--text-muted)]">No background jobs recorded.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-[var(--surface-muted)] text-left text-xs uppercase tracking-wide text-[var(--text-muted)]">
                <tr>
                  <th className="p-3">Type</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Attempts</th>
                  <th className="p-3">Run after</th>
                  <th className="p-3">Last error</th>
                  <th className="p-3">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {jobRows.map((row) => (
                  <tr key={row.id}>
                    <td className="p-3 font-mono text-xs">{row.type}</td>
                    <td className="p-3">{row.status}</td>
                    <td className="p-3">
                      {row.attempts} / {row.maxAttempts}
                    </td>
                    <td className="p-3 text-[var(--text-muted)]">
                      {new Date(row.runAfter).toLocaleString()}
                    </td>
                    <td className="p-3 text-xs text-red-700">{row.lastError ?? "—"}</td>
                    <td className="p-3 text-[var(--text-muted)]">
                      {new Date(row.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
