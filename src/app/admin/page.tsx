import type { Metadata } from "next";
import Link from "next/link";
import { isAuthConfigured } from "@/lib/auth";
export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };
const areas = [
  ["Products", "/admin/products", "Catalogue, assets and publication"],
  ["Orders", "/admin/orders", "Payment and fulfilment state"],
  ["Enquiries", "/admin/enquiries", "Contact, quote and installation requests"],
  ["Pricing", "/admin/pricing", "GST, source status and review warnings"],
];
export default function AdminPage() {
  return (
    <div className="container-standard section-space !pt-14">
      <p className="eyebrow">Protected operations</p>
      <h1 className="display-section mt-4">Admin.</h1>
      {!isAuthConfigured() && (
        <div className="mt-8 rounded-2xl border border-amber-300 bg-amber-50 p-5">
          <strong>Configuration mode.</strong> Add Neon, Better Auth and ADMIN_EMAILS variables
          before this interface can mutate production data.
        </div>
      )}
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {areas.map(([title, href, copy]) => (
          <Link key={href} href={href} className="surface-card p-6">
            <h2 className="font-display text-3xl font-semibold">{title}</h2>
            <p className="mt-3 text-[var(--muted)]">{copy}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
