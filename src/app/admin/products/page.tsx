import { AdminSection } from "@/components/admin-section";
export default function AdminProductsPage() {
  return (
    <AdminSection
      title="Products"
      description="Manage exact models, public assets, documents, stock and publication state."
      warnings={[
        "Seed the verified public catalogue into Neon.",
        "Use the product-source audit before changing model identity.",
        "Require exact-model confirmation before attaching a document.",
        "Archive products instead of deleting order history references.",
      ]}
    />
  );
}
