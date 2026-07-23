import type { Metadata } from "next";
import Link from "next/link";
import { isAuthConfigured } from "@/lib/auth";
export const metadata: Metadata = {
  title: "Order history",
  robots: { index: false, follow: false },
};
export default function AccountOrdersPage() {
  return (
    <div className="container-standard section-space !pt-14">
      <p className="eyebrow">Account</p>
      <h1 className="display-section mt-4">Order history.</h1>
      <div className="surface-card mt-10 p-8">
        <p className="font-display text-3xl font-semibold">
          {isAuthConfigured()
            ? "Sign in to view orders."
            : "Order history activates with production authentication."}
        </p>
        <p className="mt-4 text-[var(--text-muted)]">
          Guest orders remain accessible through the secure confirmation link.
        </p>
        <Link href={isAuthConfigured() ? "/login" : "/products"} className="button-primary mt-6">
          {isAuthConfigured() ? "Sign in" : "Continue shopping"}
        </Link>
      </div>
    </div>
  );
}
