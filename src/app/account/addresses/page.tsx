import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getAuth, isAuthConfigured } from "@/lib/auth";
import { listAddressesForUser } from "@/lib/account";
import { AddressManager } from "@/components/account/address-manager";

export const metadata: Metadata = { title: "Saved addresses", robots: { index: false, follow: false } };

export default async function AccountAddressesPage() {
  if (!isAuthConfigured()) redirect("/login");
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) redirect("/login?next=/account/addresses");
  const addresses = await listAddressesForUser(session.user.id);

  return (
    <div className="container-standard section-space !pt-14">
      <Link href="/account" className="text-sm font-bold underline">
        ← Account
      </Link>
      <p className="eyebrow mt-6">Account</p>
      <h1 className="display-section mt-2">Saved addresses.</h1>
      <div className="mt-8">
        <AddressManager addresses={addresses} />
      </div>
    </div>
  );
}
