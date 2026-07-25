import type { Metadata } from "next";
import {
  AdminCard,
  AdminNotConnected,
  AdminPage,
  AdminTableScroll,
} from "@/components/admin-section";
import { AdminRoleForm } from "@/components/admin-role-form";
import { siteConfig } from "@/config/site";
import { listStaff } from "@/data/admin-repository";
import { isGoogleAuthConfigured } from "@/lib/auth";
import { requireCapability, roleLabel, type Role } from "@/lib/authz";

export const metadata: Metadata = { title: "Settings", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const user = await requireCapability("settings.manage", "/admin/settings");
  const staff = await listStaff();

  const integrations = [
    ["Database (Neon)", Boolean(process.env.DATABASE_URL)],
    ["Google sign-in", isGoogleAuthConfigured()],
    ["Razorpay payments", Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET)],
    ["Razorpay webhook", Boolean(process.env.RAZORPAY_WEBHOOK_SECRET)],
    ["Email (Resend)", Boolean(process.env.RESEND_API_KEY)],
    ["WhatsApp notifications", Boolean(process.env.WHATSAPP_ACCESS_TOKEN)],
    ["Rate limiting (Upstash)", Boolean(process.env.UPSTASH_REDIS_REST_URL)],
  ] as const;

  return (
    <AdminPage
      title="Store & staff"
      description="Legal invoice identity and integration state. Secrets are never rendered — only whether each service is configured."
    >
      <div className="grid gap-5 xl:grid-cols-2 xl:items-start">
        <AdminCard title="Legal seller identity">
          <dl className="grid gap-3 p-5 text-sm">
            <Row label="Trading name" value={siteConfig.name} />
            <Row label="Legal name (invoices)" value={siteConfig.legalName} />
            <Row label="GSTIN" value={siteConfig.gstin ?? "Not configured"} />
            <Row
              label="Registered address"
              value={`${siteConfig.address.street}, ${siteConfig.address.city} ${siteConfig.address.postalCode}`}
            />
            <Row label="Public site URL" value={siteConfig.url} />
          </dl>
          <p className="border-t border-[var(--line)] p-5 text-xs leading-5 text-[var(--muted)]">
            Legal identity is read from <code>BUSINESS_LEGAL_NAME</code> and{" "}
            <code>BUSINESS_GSTIN</code>, so it appears on invoices and legal pages without being
            part of the storefront marketing.
          </p>
        </AdminCard>

        <AdminCard title="Integrations">
          <ul className="divide-y divide-[var(--line)]">
            {integrations.map(([label, configured]) => (
              <li key={label} className="flex items-center justify-between px-5 py-3 text-sm">
                <span>{label}</span>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase ${
                    configured
                      ? "border-green-200 bg-green-50 text-[var(--success)]"
                      : "border-[var(--line)] bg-[var(--canvas-alt)] text-[var(--muted)]"
                  }`}
                >
                  {configured ? "Configured" : "Not set"}
                </span>
              </li>
            ))}
          </ul>
        </AdminCard>
      </div>

      <AdminCard title="Staff and roles" className="mt-5">
        {!staff ? (
          <div className="p-5">
            <AdminNotConnected what="Staff management" />
          </div>
        ) : staff.length === 0 ? (
          <p className="p-8 text-center text-sm text-[var(--muted)]">
            No elevated accounts yet. Sign in with an address listed in <code>ADMIN_EMAILS</code> to
            bootstrap the first owner, then grant roles here.
          </p>
        ) : (
          <AdminTableScroll>
            <thead>
              <tr className="border-b border-[var(--line)] text-left text-xs uppercase tracking-[0.05em] text-[var(--muted)]">
                <th className="px-4 py-2.5 font-bold">Name</th>
                <th className="px-4 py-2.5 font-bold">Email</th>
                <th className="px-4 py-2.5 font-bold">Current role</th>
                <th className="px-4 py-2.5 font-bold">Change</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((member) => (
                <tr key={member.id} className="border-b border-[var(--line)]">
                  <td className="px-4 py-3 font-semibold">{member.name}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">{member.email}</td>
                  <td className="px-4 py-3">{roleLabel(member.role as Role)}</td>
                  <td className="px-4 py-3">
                    <AdminRoleForm
                      userId={member.id}
                      email={member.email}
                      current={member.role}
                      isSelf={member.id === user.id}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </AdminTableScroll>
        )}
      </AdminCard>
    </AdminPage>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-[var(--muted)]">{label}</dt>
      <dd className="break-all text-right font-semibold">{value}</dd>
    </div>
  );
}
