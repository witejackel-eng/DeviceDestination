import type { Metadata } from "next";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/db/client";
import { brands, categories } from "@/db/schema";
import { ProductForm } from "@/components/admin/product-form";

import { requireAdmin } from "@/lib/admin-auth";
export const metadata: Metadata = { title: "Admin · New product", robots: { index: false, follow: false } };

export default async function NewProductPage() {
  await requireAdmin();
  let brandRows: Array<{ slug: string; name: string }> = [];
  let categoryRows: Array<{ slug: string; name: string }> = [];
  if (isDatabaseConfigured()) {
    const db = getDb();
    brandRows = await db.select({ slug: brands.slug, name: brands.name }).from(brands);
    categoryRows = await db.select({ slug: categories.slug, name: categories.name }).from(categories);
  }
  return (
    <div className="container-standard section-space !pt-14">
      <Link href="/admin/products" className="text-sm font-bold underline">
        ← Products
      </Link>
      <p className="eyebrow mt-6">Operations</p>
      <h1 className="display-section mt-2">New product.</h1>
      <p className="mt-4 max-w-2xl text-[var(--text-muted)]">
        Create a draft product. New products are <strong>not</strong> visible to customers until
        published. The exact model number is the immutable identity anchor.
      </p>
      <div className="surface-card mt-8 p-6 sm:p-8">
        <ProductForm mode="create" brands={brandRows} categories={categoryRows} />
      </div>
    </div>
  );
}
