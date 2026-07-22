import type { Metadata } from "next";
import { AccountPanel } from "@/components/account-panel";
import { isAuthConfigured } from "@/lib/auth";
export const metadata: Metadata = { title: "Account", robots: { index: false, follow: false } };
export default function AccountPage() {
  return (
    <div className="container-standard section-space !pt-14">
      <p className="eyebrow">Your details</p>
      <h1 className="display-section mt-4">Account.</h1>
      <div className="mt-10">
        <AccountPanel authConfigured={isAuthConfigured()} />
      </div>
    </div>
  );
}
