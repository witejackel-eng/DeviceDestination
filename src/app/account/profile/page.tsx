import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getAuth, isAuthConfigured } from "@/lib/auth";
import { ProfilePanel } from "@/components/account/profile-panel";

export const metadata: Metadata = { title: "Profile", robots: { index: false, follow: false } };

export default async function AccountProfilePage() {
  if (!isAuthConfigured()) redirect("/login");
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) redirect("/login?next=/account/profile");
  return (
    <div className="container-standard section-space !pt-14">
      <Link href="/account" className="text-sm font-bold underline">
        ← Account
      </Link>
      <p className="eyebrow mt-6">Account</p>
      <h1 className="display-section mt-2">Profile.</h1>
      <div className="mt-8">
        <ProfilePanel
          user={{
            id: session.user.id,
            name: session.user.name,
            email: session.user.email,
            mobile: (session.user as { mobile?: string | null }).mobile ?? null,
          }}
        />
      </div>
    </div>
  );
}
