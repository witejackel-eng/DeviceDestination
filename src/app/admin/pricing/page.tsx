import { AdminSection } from "@/components/admin-section";
export default function AdminPricingPage() {
  return (
    <AdminSection
      title="Pricing"
      description="Review GST-inclusive selling prices and substantiated comparison references."
      warnings={[
        "All 19 migrated products require current competitive price verification.",
        "Never publish supplier landed cost.",
        "Show MRP only with manufacturer or distributor evidence.",
        "Reject selling prices above a verified MRP.",
      ]}
    />
  );
}
