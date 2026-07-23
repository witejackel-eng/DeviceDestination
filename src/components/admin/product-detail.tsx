"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  updateProductPriceAction,
  updateProductStatusAction,
  updateStockStatusAction,
} from "@/app/admin/actions/products";
import { formatPrice } from "@/lib/products";

type Product = {
  id: string;
  slug: string;
  model: string;
  title: string;
  status: "draft" | "published" | "archived";
  stockStatus: "in_stock" | "limited" | "lead_time" | "quote_only";
  sellingPriceInclGstPaise: number | null;
  mrpInclGstPaise: number | null;
  compareAtPriceInclGstPaise: number | null;
  compareAtLabel: string | null;
  gstRateBasisPoints: number;
  priceSourceStatus: "verified" | "request_price" | "needs_review";
  priceVerifiedAt: Date | null;
  publicSourceLabel: string | null;
  leadTime: string | null;
};
type PriceHistory = {
  id: string;
  previousPricePaise: number | null;
  newPricePaise: number | null;
  gstRateBasisPoints: number;
  previousSourceStatus: string | null;
  newSourceStatus: string | null;
  changedBy: string;
  changeReason: string | null;
  createdAt: Date;
};
type Image = { id: string; url: string; alt: string; position: number };
type Document = {
  id: string;
  type: string;
  title: string;
  url: string;
  modelVerified: boolean;
  createdAt: Date;
};
type Spec = { id: string; groupName: string; label: string; value: string; position: number };
type Highlight = { id: string; text: string; position: number };

export function ProductDetail({
  data,
}: {
  data: {
    product: Product;
    brand?: { slug: string; name: string } | null;
    category?: { slug: string; name: string } | null;
    images: Image[];
    documents: Document[];
    specs: Spec[];
    highlights: Highlight[];
    priceHistory: PriceHistory[];
  };
}) {
  const router = useRouter();
  const [priceError, setPriceError] = useState("");
  const [statusError, setStatusError] = useState("");
  const [saving, setSaving] = useState(false);
  const { product } = data;

  async function handlePrice(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPriceError("");
    setSaving(true);
    const formData = new FormData(event.currentTarget);
    const sellingRaw = String(formData.get("sellingPriceInclGstPaise") ?? "");
    const mrpRaw = String(formData.get("mrpInclGstPaise") ?? "");
    const result = await updateProductPriceAction({
      productId: product.id,
      sellingPriceInclGstPaise: sellingRaw === "" ? null : Number(sellingRaw),
      mrpInclGstPaise: mrpRaw === "" ? null : Number(mrpRaw),
      compareAtPriceInclGstPaise: product.compareAtPriceInclGstPaise,
      compareAtLabel: product.compareAtLabel,
      gstRateBasisPoints: Number(formData.get("gstRateBasisPoints") ?? product.gstRateBasisPoints),
      priceSourceStatus: String(formData.get("priceSourceStatus")) as "verified" | "request_price" | "needs_review",
      publicSourceLabel: String(formData.get("publicSourceLabel") ?? "") || null,
      changeReason: String(formData.get("changeReason") ?? "") || undefined,
    });
    setSaving(false);
    if (!result.ok) setPriceError(result.reason);
    else router.refresh();
  }

  async function handleStatus(status: "draft" | "published" | "archived") {
    setStatusError("");
    const result = await updateProductStatusAction({ productId: product.id, status });
    if (!result.ok) setStatusError(result.reason);
    else router.refresh();
  }

  async function handleStockStatus(stockStatus: "in_stock" | "limited" | "lead_time" | "quote_only") {
    setStatusError("");
    const result = await updateStockStatusAction({ productId: product.id, stockStatus });
    if (!result.ok) setStatusError(result.reason);
    else router.refresh();
  }

  const inputClass =
    "h-12 w-full rounded-[var(--radius-btn)] border border-[var(--border)] bg-[var(--surface)] px-3";

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      <div className="surface-card p-6">
        <h2 className="font-display text-2xl font-semibold">Publication & stock</h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[var(--text-muted)]">Status</dt>
            <dd className="mt-1 font-semibold">{product.status}</dd>
          </div>
          <div>
            <dt className="text-[var(--text-muted)]">Stock</dt>
            <dd className="mt-1 font-semibold">{product.stockStatus.replaceAll("_", " ")}</dd>
          </div>
          <div>
            <dt className="text-[var(--text-muted)]">Brand</dt>
            <dd className="mt-1">{data.brand?.name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-[var(--text-muted)]">Category</dt>
            <dd className="mt-1">{data.category?.name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-[var(--text-muted)]">Lead time</dt>
            <dd className="mt-1">{product.leadTime ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-[var(--text-muted)]">Price verified at</dt>
            <dd className="mt-1">
              {product.priceVerifiedAt ? new Date(product.priceVerifiedAt).toLocaleString() : "—"}
            </dd>
          </div>
        </dl>
        <div className="mt-6 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => handleStatus("draft")}
            className="button-secondary"
            disabled={product.status === "draft"}
          >
            Move to draft
          </button>
          <button
            type="button"
            onClick={() => handleStatus("published")}
            className="button-primary"
            disabled={product.status === "published"}
          >
            Publish
          </button>
          <button
            type="button"
            onClick={() => handleStatus("archived")}
            className="button-secondary"
            disabled={product.status === "archived"}
          >
            Archive (soft-delete)
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {(["in_stock", "limited", "lead_time", "quote_only"] as const).map((stockStatus) => (
            <button
              key={stockStatus}
              type="button"
              onClick={() => handleStockStatus(stockStatus)}
              className="button-secondary"
              disabled={product.stockStatus === stockStatus}
            >
              {stockStatus.replaceAll("_", " ")}
            </button>
          ))}
        </div>
        {statusError && <p className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-800">{statusError}</p>}
      </div>

      <div className="surface-card p-6">
        <h2 className="font-display text-2xl font-semibold">Pricing</h2>
        <form onSubmit={handlePrice} className="mt-4 grid gap-4">
          <label className="text-sm">
            <span className="block text-[var(--text-muted)]">Selling price (paise, GST-inclusive)</span>
            <input
              name="sellingPriceInclGstPaise"
              type="number"
              step="1"
              defaultValue={product.sellingPriceInclGstPaise ?? ""}
              className={`mt-1 ${inputClass}`}
            />
          </label>
          <label className="text-sm">
            <span className="block text-[var(--text-muted)]">MRP (paise, GST-inclusive)</span>
            <input
              name="mrpInclGstPaise"
              type="number"
              step="1"
              defaultValue={product.mrpInclGstPaise ?? ""}
              className={`mt-1 ${inputClass}`}
            />
          </label>
          <label className="text-sm">
            <span className="block text-[var(--text-muted)]">GST rate (basis points, 1800 = 18%)</span>
            <input
              name="gstRateBasisPoints"
              type="number"
              step="1"
              min="0"
              max="10000"
              required
              defaultValue={product.gstRateBasisPoints}
              className={`mt-1 ${inputClass}`}
            />
          </label>
          <label className="text-sm">
            <span className="block text-[var(--text-muted)]">Price source status</span>
            <select
              name="priceSourceStatus"
              defaultValue={product.priceSourceStatus}
              className={`mt-1 ${inputClass}`}
            >
              <option value="verified">Verified</option>
              <option value="request_price">Request price</option>
              <option value="needs_review">Needs review</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="block text-[var(--text-muted)]">Public source label (optional)</span>
            <input
              name="publicSourceLabel"
              defaultValue={product.publicSourceLabel ?? ""}
              className={`mt-1 ${inputClass}`}
            />
          </label>
          <label className="text-sm">
            <span className="block text-[var(--text-muted)]">Change reason (optional)</span>
            <input name="changeReason" className={`mt-1 ${inputClass}`} />
          </label>
          {priceError && <p className="rounded-md bg-red-50 p-3 text-sm text-red-800">{priceError}</p>}
          <button type="submit" disabled={saving} className="button-primary">
            {saving ? "Saving…" : "Update price"}
          </button>
        </form>
      </div>

      <div className="surface-card p-6 lg:col-span-2">
        <h2 className="font-display text-2xl font-semibold">Price history</h2>
        {data.priceHistory.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--text-muted)]">No price changes recorded yet.</p>
        ) : (
          <table className="mt-4 w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-[var(--text-muted)]">
              <tr>
                <th className="p-2">When</th>
                <th className="p-2">Previous</th>
                <th className="p-2">New</th>
                <th className="p-2">Source</th>
                <th className="p-2">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {data.priceHistory.map((row) => (
                <tr key={row.id}>
                  <td className="p-2 text-[var(--text-muted)]">
                    {new Date(row.createdAt).toLocaleString()}
                  </td>
                  <td className="p-2">
                    {row.previousPricePaise !== null ? formatPrice(row.previousPricePaise) : "—"}
                  </td>
                  <td className="p-2">
                    {row.newPricePaise !== null ? formatPrice(row.newPricePaise) : "—"}
                  </td>
                  <td className="p-2 font-mono text-xs">
                    {row.previousSourceStatus ?? "—"} → {row.newSourceStatus ?? "—"}
                  </td>
                  <td className="p-2">{row.changeReason ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="surface-card p-6 lg:col-span-2">
        <h2 className="font-display text-2xl font-semibold">Images ({data.images.length})</h2>
        {data.images.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--text-muted)]">
            No images uploaded. Use the image upload (requires BLOB_READ_WRITE_TOKEN) to attach
            assets. Existing local paths remain readable.
          </p>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {data.images.map((image) => (
              <div key={image.id} className="overflow-hidden rounded-md border border-[var(--border)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.url} alt={image.alt} className="h-32 w-full object-cover" />
                <p className="truncate p-2 text-xs text-[var(--text-muted)]">{image.alt}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="surface-card p-6 lg:col-span-2">
        <h2 className="font-display text-2xl font-semibold">
          Documents ({data.documents.length})
        </h2>
        {data.documents.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--text-muted)]">No documents attached.</p>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-[var(--text-muted)]">
              <tr>
                <th className="p-2">Type</th>
                <th className="p-2">Title</th>
                <th className="p-2">Model verified</th>
                <th className="p-2">URL</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {data.documents.map((doc) => (
                <tr key={doc.id}>
                  <td className="p-2 font-mono text-xs">{doc.type}</td>
                  <td className="p-2">{doc.title}</td>
                  <td className="p-2">{doc.modelVerified ? "yes" : "no"}</td>
                  <td className="p-2 truncate font-mono text-xs">
                    <a href={doc.url} target="_blank" rel="noreferrer" className="underline">
                      open
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="surface-card p-6 lg:col-span-2">
        <h2 className="font-display text-2xl font-semibold">Specs ({data.specs.length})</h2>
        {data.specs.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--text-muted)]">No specs recorded.</p>
        ) : (
          <dl className="mt-3 grid gap-2 sm:grid-cols-2">
            {data.specs.map((spec) => (
              <div key={spec.id} className="border-b border-[var(--border)] py-2 text-sm">
                <dt className="text-xs uppercase tracking-wide text-[var(--text-muted)]">
                  {spec.groupName} · {spec.label}
                </dt>
                <dd className="mt-1">{spec.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      <div className="surface-card p-6 lg:col-span-2">
        <h2 className="font-display text-2xl font-semibold">Highlights ({data.highlights.length})</h2>
        {data.highlights.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--text-muted)]">No highlights recorded.</p>
        ) : (
          <ul className="mt-3 list-inside list-disc text-sm">
            {data.highlights.map((highlight) => (
              <li key={highlight.id}>{highlight.text}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
