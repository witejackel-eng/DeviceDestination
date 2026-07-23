import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductForAdmin, listProductsForAdmin } from "@/app/admin/actions/products";
import { ProductDetail } from "@/components/admin/product-detail";

export const metadata: Metadata = { title: "Admin · Product", robots: { index: false, follow: false } };

type Params = Promise<{ id: string }>;

export default async function AdminProductDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const data = await getProductForAdmin(id);
  if (!data) notFound();
  return (
    <div className="container-standard section-space !pt-14">
      <Link href="/admin/products" className="text-sm font-bold underline">
        ← Products
      </Link>
      <p className="eyebrow mt-6">Operations</p>
      <h1 className="display-section mt-2">{data.product.title}</h1>
      <p className="mt-4 font-mono text-sm text-[var(--text-muted)]">{data.product.model}</p>
      <div className="mt-8">
        <ProductDetail data={data} />
      </div>
    </div>
  );
}
