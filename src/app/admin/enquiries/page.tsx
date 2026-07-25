import type { Metadata } from "next";
import { AdminCard, AdminNotConnected, AdminPage } from "@/components/admin-section";
import { listAdminEnquiries } from "@/data/admin-repository";
import { requireCapability } from "@/lib/authz";

export const metadata: Metadata = { title: "Enquiries", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminEnquiriesPage() {
  await requireCapability("orders.view", "/admin/enquiries");
  const rows = await listAdminEnquiries();

  return (
    <AdminPage
      title="Enquiries"
      description="Contact, quote and installation requests, keyed by the server-generated reference given to the customer."
    >
      {!rows ? (
        <AdminNotConnected what="Enquiries" />
      ) : rows.length === 0 ? (
        <AdminCard>
          <p className="p-8 text-center text-sm text-[var(--muted)]">No enquiries recorded yet.</p>
        </AdminCard>
      ) : (
        <ul className="grid gap-3">
          {rows.map((enquiry) => (
            <li key={enquiry.id} className="rounded-[16px] border border-[var(--line)] bg-white p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <p className="font-mono text-sm font-bold">{enquiry.referenceNumber}</p>
                <p className="text-xs text-[var(--muted)]">
                  {enquiry.type} · {enquiry.createdAt.toLocaleString("en-IN")}
                </p>
              </div>
              <p className="mt-2 text-sm font-semibold">{enquiry.name}</p>
              <p className="text-xs text-[var(--muted)]">
                {enquiry.email} · {enquiry.mobile}
              </p>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{enquiry.message}</p>
            </li>
          ))}
        </ul>
      )}
    </AdminPage>
  );
}
