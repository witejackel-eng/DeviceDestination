import type { Metadata } from "next";
import Link from "next/link";
import { listSettings } from "@/lib/settings";
import { SettingsForm } from "@/components/admin/settings-form";

export const metadata: Metadata = { title: "Admin · Settings", robots: { index: false, follow: false } };

export default async function AdminSettingsPage() {
  const settings = await listSettings();
  return (
    <div className="container-standard section-space !pt-14">
      <Link href="/admin" className="text-sm font-bold underline">
        ← Admin
      </Link>
      <p className="eyebrow mt-6">Operations</p>
      <h1 className="display-section mt-2">Settings.</h1>
      <p className="mt-4 max-w-2xl text-[var(--text-muted)]">
        Non-secret operational settings. Secrets remain environment variables. All changes are
        audit-logged.
      </p>
      <div className="mt-6 flex flex-wrap gap-2 text-sm">
        <Link
          href="/admin/settings"
          className="rounded-md border border-[var(--border)] bg-[var(--ink)] px-3 py-1 text-[var(--surface)]"
        >
          General
        </Link>
        <Link
          href="/admin/settings/shipping"
          className="rounded-md border border-[var(--border)] px-3 py-1"
        >
          Shipping
        </Link>
      </div>
      <div className="surface-card mt-4 p-6">
        <SettingsForm settings={settings} />
      </div>
    </div>
  );
}
