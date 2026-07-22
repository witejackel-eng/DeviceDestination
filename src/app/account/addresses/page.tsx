import type { Metadata } from "next";
import Link from "next/link";
import { isAuthConfigured } from "@/lib/auth";
export const metadata: Metadata = {
  title: "Saved addresses",
  robots: { index: false, follow: false },
};
export default function AccountAddressesPage() {
  return (
    <div className="container-standard section-space !pt-14">
      <p className="eyebrow">Account</p>
      <h1 className="display-section mt-4">Saved addresses.</h1>
      <div className="surface-card mt-10 p-8">
        <p className="font-display text-3xl font-semibold">
          {isAuthConfigured()
            ? "Sign in to manage addresses."
            : "Saved addresses activate with production authentication."}
        </p>
        <p className="mt-4 text-[var(--muted)]">
          Guest checkout accepts a delivery address without creating an account.
        </p>
        <Link href="/checkout" className="button-primary mt-6">
          Guest checkout
        </Link>
      </div>
    </div>
  );
}
