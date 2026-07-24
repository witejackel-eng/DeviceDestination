import type { Metadata } from "next";
import Link from "next/link";
import { listEnquiriesForAdmin } from "@/app/admin/actions/enquiries";

import { requireAdmin } from "@/lib/admin-auth";
export const metadata: Metadata = { title: "Admin · Enquiries", robots: { index: false, follow: false } };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminEnquiriesPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin();
  const query = await searchParams;
  const status = (typeof query.status === "string" ? query.status : "all") as
    | "new"
    | "contacted"
    | "qualified"
    | "quoted"
    | "won"
    | "lost"
    | "closed"
    | "all";
  const search = typeof query.search === "string" ? query.search : "";
  const page = Number(query.page ?? "1");
  const result = await listEnquiriesForAdmin({ status, search, page, pageSize: 25 });

  return (
    <div className="container-standard section-space !pt-14">
      <Link href="/admin" className="text-sm font-bold underline">
        ← Admin
      </Link>
      <p className="eyebrow mt-6">Operations</p>
      <h1 className="display-section mt-2">Enquiries.</h1>

      <form className="surface-card mt-6 grid gap-3 p-5 sm:grid-cols-3">
        <label className="text-sm">
          <span className="block text-[var(--text-muted)]">Status</span>
          <select
            name="status"
            defaultValue={status}
            className="mt-1 h-11 w-full rounded-[var(--radius-btn)] border border-[var(--border)] bg-[var(--surface)] px-3"
          >
            <option value="all">All</option>
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="qualified">Qualified</option>
            <option value="quoted">Quoted</option>
            <option value="won">Won</option>
            <option value="lost">Lost</option>
            <option value="closed">Closed</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="block text-[var(--text-muted)]">Search</span>
          <input
            name="search"
            defaultValue={search}
            className="mt-1 h-11 w-full rounded-[var(--radius-btn)] border border-[var(--border)] bg-[var(--surface)] px-3"
            placeholder="Reference, name, email or mobile"
          />
        </label>
        <button type="submit" className="button-primary">Apply</button>
      </form>

      <div className="surface-card mt-4 overflow-hidden">
        {result.items.length === 0 ? (
          <p className="p-6 text-sm text-[var(--text-muted)]">No enquiries match the current filter.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[var(--surface-muted)] text-left text-xs uppercase tracking-wide text-[var(--text-muted)]">
              <tr>
                <th className="p-3">Reference</th>
                <th className="p-3">Type</th>
                <th className="p-3">Customer</th>
                <th className="p-3">Mobile</th>
                <th className="p-3">Status</th>
                <th className="p-3">Assigned to</th>
                <th className="p-3">Follow-up</th>
                <th className="p-3">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {result.items.map((row) => (
                <tr key={row.id} className="hover:bg-[var(--surface-muted)]">
                  <td className="p-3 font-mono text-xs">
                    <Link href={`/admin/enquiries/${row.id}`} className="underline">
                      {row.referenceNumber}
                    </Link>
                  </td>
                  <td className="p-3">{row.type}</td>
                  <td className="p-3">{row.name}</td>
                  <td className="p-3 font-mono text-xs">{row.mobile}</td>
                  <td className="p-3">{row.status}</td>
                  <td className="p-3 text-xs">{row.assignedTo ?? "—"}</td>
                  <td className="p-3 text-[var(--text-muted)] text-xs">
                    {row.followUpAt ? new Date(row.followUpAt).toLocaleDateString() : "—"}
                  </td>
                  <td className="p-3 text-[var(--text-muted)] text-xs">
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
