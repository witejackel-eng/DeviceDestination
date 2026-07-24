import type { Metadata } from "next";
import Link from "next/link";
import { listProductsForAdmin } from "@/app/admin/actions/products";
import { formatPrice } from "@/lib/products";

import { requireAdmin } from "@/lib/admin-auth";
export const metadata: Metadata = { title: "Admin · Products", robots: { index: false, follow: false } };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminProductsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin();
  const query = await searchParams;
  const search = typeof query.search === "string" ? query.search : "";
  const status = (typeof query.status === "string" ? query.status : "all") as
    | "draft"
    | "published"
    | "archived"
    | "all";
  const stockStatus = (typeof query.stockStatus === "string" ? query.stockStatus : "all") as
    | "in_stock"
    | "limited"
    | "lead_time"
    | "quote_only"
    | "all";
  const priceSourceStatus = (typeof query.priceSource === "string" ? query.priceSource : "all") as
    | "verified"
    | "request_price"
    | "needs_review"
    | "all";
  const stalePriceOnly = query.stale === "1";
  const page = Number(query.page ?? "1");
  const result = await listProductsForAdmin({
    search,
    status,
    stockStatus,
    priceSourceStatus,
    stalePriceOnly,
    page,
    pageSize: 25,
  });

  return (
    <div className="container-standard section-space !pt-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/admin" className="text-sm font-bold underline">
            ← Admin
          </Link>
          <p className="eyebrow mt-6">Operations</p>
          <h1 className="display-section mt-2">Products.</h1>
        </div>
        <Link href="/admin/products/new" className="button-primary">
          New product
        </Link>
      </div>

      <form className="surface-card mt-8 grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-5">
        <label className="text-sm">
          <span className="block text-[var(--text-muted)]">Search</span>
          <input
            name="search"
            defaultValue={search}
            className="mt-1 h-11 w-full rounded-[var(--radius-btn)] border border-[var(--border)] bg-[var(--surface)] px-3"
            placeholder="Model, title or slug"
          />
        </label>
        <label className="text-sm">
          <span className="block text-[var(--text-muted)]">Publication</span>
          <select
            name="status"
            defaultValue={status}
            className="mt-1 h-11 w-full rounded-[var(--radius-btn)] border border-[var(--border)] bg-[var(--surface)] px-3"
          >
            <option value="all">All</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="block text-[var(--text-muted)]">Stock</span>
          <select
            name="stockStatus"
            defaultValue={stockStatus}
            className="mt-1 h-11 w-full rounded-[var(--radius-btn)] border border-[var(--border)] bg-[var(--surface)] px-3"
          >
            <option value="all">All</option>
            <option value="in_stock">In stock</option>
            <option value="limited">Limited</option>
            <option value="lead_time">Lead time</option>
            <option value="quote_only">Quote only</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="block text-[var(--text-muted)]">Price source</span>
          <select
            name="priceSource"
            defaultValue={priceSourceStatus}
            className="mt-1 h-11 w-full rounded-[var(--radius-btn)] border border-[var(--border)] bg-[var(--surface)] px-3"
          >
            <option value="all">All</option>
            <option value="verified">Verified</option>
            <option value="request_price">Request price</option>
            <option value="needs_review">Needs review</option>
          </select>
        </label>
        <label className="flex items-end gap-2 text-sm">
          <input type="checkbox" name="stale" value="1" defaultChecked={stalePriceOnly} className="h-4 w-4" />
          <span>Stale price only</span>
        </label>
        <button type="submit" className="button-primary sm:col-span-2 lg:col-span-5">
          Apply filters
        </button>
      </form>

      <div className="surface-card mt-6 overflow-hidden">
        {result.items.length === 0 ? (
          <p className="p-6 text-sm text-[var(--text-muted)]">
            No products match the current filters. Database may be unconfigured.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[var(--surface-muted)] text-left text-xs uppercase tracking-wide text-[var(--text-muted)]">
              <tr>
                <th className="p-3">Model</th>
                <th className="p-3">Title</th>
                <th className="p-3">Status</th>
                <th className="p-3">Stock</th>
                <th className="p-3">Price</th>
                <th className="p-3">Source</th>
                <th className="p-3">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {result.items.map((item) => (
                <tr key={item.id} className="hover:bg-[var(--surface-muted)]">
                  <td className="p-3 font-mono text-xs">
                    <Link href={`/admin/products/${item.id}`} className="underline">
                      {item.model}
                    </Link>
                  </td>
                  <td className="p-3">{item.title}</td>
                  <td className="p-3">{item.status}</td>
                  <td className="p-3">{item.stockStatus.replaceAll("_", " ")}</td>
                  <td className="p-3">
                    {item.sellingPriceInclGstPaise !== null ? formatPrice(item.sellingPriceInclGstPaise) : "—"}
                  </td>
                  <td className="p-3">{item.priceSourceStatus.replaceAll("_", " ")}</td>
                  <td className="p-3 text-[var(--text-muted)]">
                    {new Date(item.updatedAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {result.total > 25 && (
        <div className="mt-4 flex gap-2 text-sm">
          {Array.from({ length: Math.ceil(result.total / 25) }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`/admin/products?page=${p}&search=${encodeURIComponent(search)}&status=${status}&stockStatus=${stockStatus}&priceSource=${priceSourceStatus}&stale=${stalePriceOnly ? "1" : "0"}`}
              className={`rounded-md border border-[var(--border)] px-3 py-1 ${p === result.page ? "bg-[var(--ink)] text-[var(--surface)]" : ""}`}
            >
              {p}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
