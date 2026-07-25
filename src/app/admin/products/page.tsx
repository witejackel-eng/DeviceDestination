import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  AdminCard,
  AdminNotConnected,
  AdminPage,
  AdminStatus,
  AdminTableScroll,
} from "@/components/admin-section";
import { AdminProductFilters } from "@/components/admin-product-filters";
import { listAdminProducts } from "@/data/admin-repository";
import { requireCapability } from "@/lib/authz";
import { formatPrice } from "@/lib/products";

export const metadata: Metadata = { title: "Products", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  await requireCapability("catalogue.manage", "/admin/products");
  const params = await searchParams;
  const rows = await listAdminProducts();

  if (!rows)
    return (
      <AdminPage title="Products" description="Catalogue, assets, pricing and publication state.">
        <AdminNotConnected what="The product table" />
      </AdminPage>
    );

  const query = (params.q ?? "").trim().toLowerCase();
  const statusFilter = params.status ?? "all";
  const filtered = rows.filter((row) => {
    if (statusFilter !== "all" && row.status !== statusFilter) return false;
    if (!query) return true;
    return [row.title, row.model, row.brand, row.category, row.slug]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });

  const page = Math.max(1, Number(params.page) || 1);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const buildHref = (nextPage: number) => {
    const search = new URLSearchParams();
    if (params.q) search.set("q", params.q);
    if (params.status) search.set("status", params.status);
    if (nextPage > 1) search.set("page", String(nextPage));
    const suffix = search.toString();
    return suffix ? `/admin/products?${suffix}` : "/admin/products";
  };

  return (
    <AdminPage
      title="Products"
      description={`${rows.length} products in the catalogue. Saving writes to the database and revalidates the storefront route.`}
    >
      <AdminProductFilters />

      <AdminCard className="mt-5">
        {visible.length === 0 ? (
          <p className="p-8 text-center text-sm text-[var(--muted)]">
            No products match this search.
          </p>
        ) : (
          <AdminTableScroll>
            <thead>
              <tr className="border-b border-[var(--line)] text-left text-xs uppercase tracking-[0.05em] text-[var(--muted)]">
                <th className="px-4 py-2.5 font-bold">Product</th>
                <th className="px-4 py-2.5 font-bold">Model</th>
                <th className="px-4 py-2.5 font-bold">Category</th>
                <th className="px-4 py-2.5 text-right font-bold">Price</th>
                <th className="px-4 py-2.5 text-right font-bold">Stock</th>
                <th className="px-4 py-2.5 font-bold">Status</th>
                <th className="px-4 py-2.5 font-bold">Updated</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.id} className="border-b border-[var(--line)] align-middle">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--canvas-alt)]">
                        {row.image && (
                          <Image
                            src={row.image}
                            alt=""
                            fill
                            sizes="40px"
                            className="object-contain p-[8%]"
                          />
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className="block max-w-[280px] truncate font-semibold">
                          {row.title}
                        </span>
                        <span className="block text-xs text-[var(--muted)]">{row.brand}</span>
                      </span>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">{row.model}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-[var(--muted)]">{row.category}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    {formatPrice(row.sellingPriceInclGstPaise)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    {row.quantityAvailable ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <AdminStatus status={row.status} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-[var(--muted)]">
                    {row.updatedAt.toLocaleDateString("en-IN")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/products/${row.id}`} className="text-sm font-bold underline">
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </AdminTableScroll>
        )}
      </AdminCard>

      {pageCount > 1 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
          <p className="text-[var(--muted)]">
            Page {page} of {pageCount} · {filtered.length} matching products
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={buildHref(page - 1)} className="button-secondary min-h-10 !py-2 text-sm">
                Previous
              </Link>
            )}
            {page < pageCount && (
              <Link href={buildHref(page + 1)} className="button-secondary min-h-10 !py-2 text-sm">
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </AdminPage>
  );
}
