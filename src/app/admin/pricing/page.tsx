import type { Metadata } from "next";
import Link from "next/link";
import {
  AdminCard,
  AdminNotConnected,
  AdminPage,
  AdminStatus,
  AdminTableScroll,
} from "@/components/admin-section";
import { getPriceMaxAgeDays } from "@/config/site";
import { getAdminProduct, listAdminProducts } from "@/data/admin-repository";
import { requireCapability } from "@/lib/authz";
import { formatPrice } from "@/lib/products";

export const metadata: Metadata = { title: "Pricing", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Reading the clock outside the render body keeps the page component pure. */
async function currentTime() {
  return Date.now();
}

export default async function AdminPricingPage() {
  await requireCapability("catalogue.manage", "/admin/pricing");
  const rows = await listAdminProducts();

  if (!rows)
    return (
      <AdminPage title="Pricing" description="GST-inclusive selling prices and price freshness.">
        <AdminNotConnected what="Pricing review" />
      </AdminPage>
    );

  const maxAgeDays = getPriceMaxAgeDays();
  const details = await Promise.all(rows.map((row) => getAdminProduct(row.id)));
  const priced = details.flatMap((detail, index) => (detail ? [{ ...detail, row: rows[index] }] : []));

  // Read the clock once, before rendering, so every row is judged against the
  // same instant and the render itself stays a pure function of its inputs.
  const evaluatedAt = await currentTime();
  const stale = priced.filter((product) => {
    if (product.priceSourceStatus !== "verified") return false;
    if (!product.priceVerifiedAt) return true;
    return evaluatedAt - product.priceVerifiedAt.getTime() > maxAgeDays * 86_400_000;
  });

  return (
    <AdminPage
      title="Pricing"
      description={`Prices verified more than ${maxAgeDays} days ago stop being purchasable automatically. Supplier cost is never stored in this application.`}
    >
      {stale.length > 0 && (
        <p className="mb-5 rounded-[12px] border border-amber-200 bg-amber-50 p-4 text-sm">
          <strong>{stale.length}</strong> verified{" "}
          {stale.length === 1 ? "price is" : "prices are"} outside the freshness window and will show{" "}
          <em>Request latest price</em> on the storefront until re-verified.
        </p>
      )}

      <AdminCard>
        <AdminTableScroll>
          <thead>
            <tr className="border-b border-[var(--line)] text-left text-xs uppercase tracking-[0.05em] text-[var(--muted)]">
              <th className="px-4 py-2.5 font-bold">Model</th>
              <th className="px-4 py-2.5 text-right font-bold">Selling price</th>
              <th className="px-4 py-2.5 text-right font-bold">MRP</th>
              <th className="px-4 py-2.5 font-bold">GST</th>
              <th className="px-4 py-2.5 font-bold">Source status</th>
              <th className="px-4 py-2.5 font-bold">Verified</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {priced.map((product) => {
              const isStale = stale.some((item) => item.id === product.id);
              return (
                <tr key={product.id} className="border-b border-[var(--line)]">
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">{product.model}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    {formatPrice(product.sellingPriceInclGstPaise)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-[var(--muted)]">
                    {product.mrpInclGstPaise ? formatPrice(product.mrpInclGstPaise) : "Not evidenced"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {(product.gstRateBasisPoints / 100).toFixed(0)}% included
                  </td>
                  <td className="px-4 py-3">
                    <AdminStatus status={product.priceSourceStatus} />
                  </td>
                  <td
                    className={`whitespace-nowrap px-4 py-3 ${isStale ? "font-bold text-[var(--danger)]" : "text-[var(--muted)]"}`}
                  >
                    {product.priceVerifiedAt
                      ? product.priceVerifiedAt.toLocaleDateString("en-IN")
                      : "Never"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/products/${product.id}`}
                      className="text-sm font-bold underline"
                    >
                      Review
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </AdminTableScroll>
      </AdminCard>
    </AdminPage>
  );
}
