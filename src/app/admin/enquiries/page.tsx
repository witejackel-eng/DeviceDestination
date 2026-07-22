import { AdminSection } from "@/components/admin-section";
export default function AdminEnquiriesPage() {
  return (
    <AdminSection
      title="Enquiries"
      description="Review contact, quote and installation requests by server-generated reference."
      warnings={[
        "Configure the sales email and WhatsApp template.",
        "Keep customer details out of application logs.",
        "Assign ownership and record follow-up status in production.",
        "Do not mark delivery successful when providers reject the notification.",
      ]}
    />
  );
}
