import { AdminSection } from "@/components/admin-section";
export default function AdminOrdersPage() {
  return (
    <AdminSection
      title="Orders"
      description="Reconcile Razorpay payment state before fulfilment."
      warnings={[
        "Configure and verify the Razorpay webhook secret.",
        "Do not fulfil an authorized but uncaptured payment.",
        "Use provider event IDs as idempotency keys.",
        "Log fulfilment-state changes in the admin audit table.",
      ]}
    />
  );
}
