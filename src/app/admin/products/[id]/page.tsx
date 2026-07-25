import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminPage } from "@/components/admin-section";
import { AdminProductEditor } from "@/components/admin-product-editor";
import { getAdminProduct } from "@/data/admin-repository";
import { can, requireCapability } from "@/lib/authz";

export const metadata: Metadata = {
  title: "Edit product",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function AdminProductEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireCapability("catalogue.manage", "/admin/products");
  const { id } = await params;
  const product = await getAdminProduct(id);
  if (!product) notFound();

  return (
    <AdminPage
      title={product.title}
      description={`${product.brandName} · ${product.model}`}
      back={{ href: "/admin/products", label: "Products" }}
      actions={
        <Link
          href={`/products/${product.slug}`}
          className="button-secondary min-h-10 !py-2 text-sm"
          target="_blank"
        >
          View on storefront
        </Link>
      }
    >
      <AdminProductEditor
        product={product}
        canEdit={can(user.role, "catalogue.manage")}
        canEditInventory={can(user.role, "inventory.manage")}
      />
    </AdminPage>
  );
}
