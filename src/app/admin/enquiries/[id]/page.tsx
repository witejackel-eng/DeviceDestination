import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getEnquiryForAdmin } from "@/app/admin/actions/enquiries";
import { EnquiryDetail } from "@/components/admin/enquiry-detail";

export const metadata: Metadata = { title: "Admin · Enquiry", robots: { index: false, follow: false } };

type Params = Promise<{ id: string }>;

export default async function AdminEnquiryDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const enquiry = await getEnquiryForAdmin(id);
  if (!enquiry) notFound();
  return (
    <div className="container-standard section-space !pt-14">
      <Link href="/admin/enquiries" className="text-sm font-bold underline">
        ← Enquiries
      </Link>
      <p className="eyebrow mt-6">Operations</p>
      <h1 className="display-section mt-2">{enquiry.referenceNumber}</h1>
      <p className="mt-4 text-[var(--text-muted)]">
        Type: <strong>{enquiry.type}</strong> · Status: <strong>{enquiry.status}</strong>
      </p>
      <div className="surface-card mt-8 p-6">
        <h2 className="font-display text-2xl font-semibold">Customer message</h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[var(--text-muted)]">Name</dt>
            <dd className="mt-1">{enquiry.name}</dd>
          </div>
          <div>
            <dt className="text-[var(--text-muted)]">Email</dt>
            <dd className="mt-1 font-mono text-xs">{enquiry.email}</dd>
          </div>
          <div>
            <dt className="text-[var(--text-muted)]">Mobile</dt>
            <dd className="mt-1 font-mono text-xs">{enquiry.mobile}</dd>
          </div>
          <div>
            <dt className="text-[var(--text-muted)]">Created</dt>
            <dd className="mt-1">{new Date(enquiry.createdAt).toLocaleString()}</dd>
          </div>
        </dl>
        <p className="mt-4 whitespace-pre-wrap rounded-md bg-[var(--surface-muted)] p-3 text-sm">
          {enquiry.message}
        </p>
      </div>
      <div className="surface-card mt-6 p-6">
        <EnquiryDetail enquiry={enquiry} />
      </div>
    </div>
  );
}
