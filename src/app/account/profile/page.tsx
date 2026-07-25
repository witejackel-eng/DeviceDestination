import type { Metadata } from "next";
import { AccountShell } from "@/components/account-shell";
import { UnconfiguredAccountNotice } from "@/components/account-panel";
import { isAuthConfigured } from "@/lib/auth";
import { requireUser, roleLabel } from "@/lib/authz";

export const metadata: Metadata = {
  title: "Account details",
  robots: { index: false, follow: false },
};

// Session-dependent: never prerendered or cached across users.
export const dynamic = "force-dynamic";

export default async function AccountProfilePage() {
  if (!isAuthConfigured()) return <UnconfiguredAccountNotice />;
  const user = await requireUser("/account/profile");

  return (
    <AccountShell
      user={user}
      title="Account details."
      description="DeviceDestination stores only what is needed for your account, invoices and order communication."
    >
      <dl className="surface-card grid gap-5 p-6 sm:p-8">
        <Field label="Name" value={user.name || "Not provided"} />
        <Field label="Email" value={user.email} />
        <Field label="Account type" value={roleLabel(user.role)} />
      </dl>

      <p className="mt-5 max-w-2xl text-sm leading-6 text-[var(--muted)]">
        Your name and email come from the Google account you signed in with; change them there and
        they update here on your next sign-in. Delivery details are stored per order, and are shown
        under saved addresses.
      </p>
    </AccountShell>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1">
      <dt className="eyebrow">{label}</dt>
      <dd className="font-display text-2xl font-semibold">{value}</dd>
    </div>
  );
}
