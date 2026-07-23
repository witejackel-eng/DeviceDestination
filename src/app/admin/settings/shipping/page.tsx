import type { Metadata } from "next";
import Link from "next/link";
import {
  listShippingZonesForAdmin,
  listShippingRulesForAdmin,
} from "@/app/admin/actions/settings";
import { ShippingManager } from "@/components/admin/shipping-manager";

export const metadata: Metadata = {
  title: "Admin · Shipping",
  robots: { index: false, follow: false },
};

export default async function AdminShippingSettingsPage() {
  const zones = await listShippingZonesForAdmin();
  const rules = await listShippingRulesForAdmin();
  return (
    <div className="container-standard section-space !pt-14">
      <Link href="/admin/settings" className="text-sm font-bold underline">
        ← Settings
      </Link>
      <p className="eyebrow mt-6">Operations</p>
      <h1 className="display-section mt-2">Shipping.</h1>
      <p className="mt-4 max-w-2xl text-[var(--text-muted)]">
        Conservative defaults. Unknown pincodes require manual confirmation. COD is disabled unless
        explicitly set per rule. Never claim pan-India delivery automatically.
      </p>
      <div className="surface-card mt-6 p-6">
        <ShippingManager zones={zones} rules={rules} />
      </div>
    </div>
  );
}
