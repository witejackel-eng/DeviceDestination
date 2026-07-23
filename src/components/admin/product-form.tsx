"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createProductAction, updateProductAction } from "@/app/admin/actions/products";

type Brand = { slug: string; name: string };
type Category = { slug: string; name: string };
type Product = {
  id: string;
  slug: string;
  model: string;
  title: string;
  shortDescription: string;
  longDescription: string | null;
  brandId: string | null;
  categoryId: string | null;
  officialSourceUrl: string;
  seoTitle: string | null;
  seoDescription: string | null;
  warrantySummary: string | null;
  leadTime: string | null;
};
type BrandRow = { id: string; slug: string; name: string };
type CategoryRow = { id: string; slug: string; name: string };

const inputClass =
  "h-12 w-full rounded-[var(--radius-btn)] border border-[var(--border)] bg-[var(--surface)] px-3";

export function ProductForm({
  mode,
  brands,
  categories,
  product,
  brandRow,
  categoryRow,
}: {
  mode: "create" | "edit";
  brands: Brand[];
  categories: Category[];
  product?: Product;
  brandRow?: BrandRow;
  categoryRow?: CategoryRow;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaving(true);
    const formData = new FormData(event.currentTarget);
    const payload = {
      slug: String(formData.get("slug") ?? ""),
      model: String(formData.get("model") ?? ""),
      title: String(formData.get("title") ?? ""),
      shortDescription: String(formData.get("shortDescription") ?? ""),
      longDescription: String(formData.get("longDescription") ?? "") || undefined,
      brandSlug: String(formData.get("brandSlug") ?? ""),
      categorySlug: String(formData.get("categorySlug") ?? ""),
      officialSourceUrl: String(formData.get("officialSourceUrl") ?? ""),
      seoTitle: String(formData.get("seoTitle") ?? "") || undefined,
      seoDescription: String(formData.get("seoDescription") ?? "") || undefined,
      warrantySummary: String(formData.get("warrantySummary") ?? "") || undefined,
      leadTime: String(formData.get("leadTime") ?? "") || undefined,
      ...(mode === "edit" && product ? { id: product.id } : {}),
    };
    if (mode === "create") {
      const result = await createProductAction(payload as Parameters<typeof createProductAction>[0]);
      setSaving(false);
      if (!result.ok) {
        setError(result.reason);
        return;
      }
      if (result.ok && result.id) {
        router.push(`/admin/products/${result.id}`);
      }
    } else if (product) {
      const result = await updateProductAction({ ...payload, id: product.id } as Parameters<typeof updateProductAction>[0]);
      setSaving(false);
      if (!result.ok) {
        setError(result.reason);
        return;
      }
      router.refresh();
    } else {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm">
          <span className="block text-[var(--text-muted)]">Slug</span>
          <input
            name="slug"
            required
            defaultValue={product?.slug ?? ""}
            className={`mt-1 ${inputClass}`}
            pattern="[a-z0-9-]+"
            title="Lowercase, digits and hyphens only"
          />
        </label>
        <label className="text-sm">
          <span className="block text-[var(--text-muted)]">Model (immutable after reference)</span>
          <input name="model" required defaultValue={product?.model ?? ""} className={`mt-1 ${inputClass}`} />
        </label>
      </div>
      <label className="text-sm">
        <span className="block text-[var(--text-muted)]">Title</span>
        <input name="title" required defaultValue={product?.title ?? ""} className={`mt-1 ${inputClass}`} />
      </label>
      <label className="text-sm">
        <span className="block text-[var(--text-muted)]">Short description</span>
        <textarea
          name="shortDescription"
          required
          defaultValue={product?.shortDescription ?? ""}
          className="mt-1 min-h-20 w-full rounded-[var(--radius-btn)] border border-[var(--border)] bg-[var(--surface)] p-3"
        />
      </label>
      <label className="text-sm">
        <span className="block text-[var(--text-muted)]">Long description (optional)</span>
        <textarea
          name="longDescription"
          defaultValue={product?.longDescription ?? ""}
          className="mt-1 min-h-32 w-full rounded-[var(--radius-btn)] border border-[var(--border)] bg-[var(--surface)] p-3"
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm">
          <span className="block text-[var(--text-muted)]">Brand</span>
          <select
            name="brandSlug"
            required
            defaultValue={brandRow?.slug ?? ""}
            className={`mt-1 ${inputClass}`}
          >
            <option value="">Select brand</option>
            {brands.map((brand) => (
              <option key={brand.slug} value={brand.slug}>
                {brand.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="block text-[var(--text-muted)]">Category</span>
          <select
            name="categorySlug"
            required
            defaultValue={categoryRow?.slug ?? ""}
            className={`mt-1 ${inputClass}`}
          >
            <option value="">Select category</option>
            {categories.map((category) => (
              <option key={category.slug} value={category.slug}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="text-sm">
        <span className="block text-[var(--text-muted)]">Official source URL</span>
        <input
          name="officialSourceUrl"
          type="url"
          required
          defaultValue={product?.officialSourceUrl ?? ""}
          className={`mt-1 ${inputClass}`}
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm">
          <span className="block text-[var(--text-muted)]">SEO title (optional)</span>
          <input name="seoTitle" defaultValue={product?.seoTitle ?? ""} className={`mt-1 ${inputClass}`} />
        </label>
        <label className="text-sm">
          <span className="block text-[var(--text-muted)]">Warranty summary (optional)</span>
          <input
            name="warrantySummary"
            defaultValue={product?.warrantySummary ?? ""}
            className={`mt-1 ${inputClass}`}
          />
        </label>
      </div>
      <label className="text-sm">
        <span className="block text-[var(--text-muted)]">SEO description (optional)</span>
        <textarea
          name="seoDescription"
          defaultValue={product?.seoDescription ?? ""}
          className="mt-1 min-h-20 w-full rounded-[var(--radius-btn)] border border-[var(--border)] bg-[var(--surface)] p-3"
        />
      </label>
      <label className="text-sm">
        <span className="block text-[var(--text-muted)]">Lead time (optional)</span>
        <input name="leadTime" defaultValue={product?.leadTime ?? ""} className={`mt-1 ${inputClass}`} />
      </label>
      {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <div className="flex gap-3">
        <button type="submit" disabled={saving} className="button-primary">
          {saving ? "Saving…" : mode === "create" ? "Create draft product" : "Save changes"}
        </button>
        {mode === "edit" && (
          <button
            type="button"
            onClick={() => router.push("/admin/products")}
            className="button-secondary"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
