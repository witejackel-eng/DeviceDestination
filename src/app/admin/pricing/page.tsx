import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq, isNotNull, lt, sql } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/db/client";
import { products } from "@/db/schema";
import { formatPrice } from "@/lib/products";
import { getSettingInt } from "@/lib/settings";

export const metadata: Metadata = { title: "Admin · Pricing", robots: { index: false, follow: false } };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminPricingPage({ searchParams }: { searchParams: SearchParams }) {
  const query = await searchParams;
  const staleOnly = query.stale === "1";
  let rows: Array<{
    id: string;
    model: string;
    title: string;
    sellingPriceInclGstPaise: number | null;
    gstRateBasisPoints: number;
    priceSourceStatus: string;
    priceVerifiedAt: Date | null;
    stockStatus: string;
    publicSourceLabel: string | null;
  }> = [];
  if (isDatabaseConfigured()) {
    const db = getDb();
    const maxAgeDays = await getSettingInt("price_max_age_days", 30);
    // eslint-disable-next-line react-hooks/purity -- server component, not a React render function
    const cutoff = new Date(Date.now() - maxAgeDays * 86_400_000);
    const where = staleOnly
      ? and(
          sql`(${products.priceSourceStatus} != 'verified' OR ${products.priceVerifiedAt} IS NULL OR ${products.priceVerifiedAt} < ${cutoff})`,
        )
      : undefined;
    rows = await db
      .select({
        id: products.id,
        model: products.model,
        title: products.title,
        sellingPriceInclGstPaise: products.sellingPriceInclGstPaise,
        gstRateBasisPoints: products.gstRateBasisPoints,
        priceSourceStatus: products.priceSourceStatus,
        priceVerifiedAt: products.priceVerifiedAt,
        stockStatus: products.stockStatus,
        publicSourceLabel: products.publicSourceLabel,
      })
      .from(products)
      .where(where)
      .orderBy(desc(products.updatedAt))
      .limit(100);
  }
  return (
    <div className="container-standard section-space !pt-14">
      <Link href="/admin" className="text-sm font-bold underline">
        ← Admin
      </Link>
      <p className="eyebrow mt-6">Operations</p>
      <h1 className="display-section mt-2">Pricing.</h1>
      <p className="mt-4 max-w-2xl text-[var(--text-muted)]">
        GST-inclusive integer-paise pricing. All mutations record an immutable price-history entry
        and an admin audit entry. Never publish supplier landed cost.
      </p>
      <form className="surface-card mt-6 p-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="stale" value="1" defaultChecked={staleOnly} className="h-4 w-4" />
          <span>Show only stale or unverified prices</span>
        </label>
        <button type="submit" className="button-primary mt-3">Apply</button>
      </form>
      <div className="surface-card mt-4 overflow-hidden">
        {rows.length === 0 ? (
          <p className="p-6 text-sm text-[var(--text-muted)]">
            No products. Database may be unconfigured or all prices are verified.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[var(--surface-muted)] text-left text-xs uppercase tracking-wide text-[var(--text-muted)]">
              <tr>
                <th className="p-3">Model</th>
                <th className="p-3">Price</th>
                <th className="p-3">GST</th>
                <th className="p-3">Source</th>
                <th className="p-3">Verified at</th>
                <th className="p-3">Stock</th>
                <th className="p-3">Public source</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {rows.map((row) => {
                const stale =
                  !row.priceVerifiedAt ||
                  row.priceSourceStatus !== "verified" ||
                  // eslint-disable-next-line react-hooks/purity -- server component
                  Date.now() - row.priceVerifiedAt.getTime() > 30 * 86_400_000;
                return (
                  <tr key={row.id} className={stale ? "bg-amber-50/40" : ""}>
                    <td className="p-3 font-mono text-xs">{row.model}</td>
                    <td className="p-3">
                      {row.sellingPriceInclGstPaise !== null
                        ? formatPrice(row.sellingPriceInclGstPaise)
                        : "—"}
                    </td>
                    <td className="p-3 font-mono text-xs">{row.gstRateBasisPoints / 100}%</td>
                    <td className="p-3">{row.priceSourceStatus.replaceAll("_", " ")}</td>
                    <td className="p-3 text-[var(--text-muted)]">
                      {row.priceVerifiedAt ? new Date(row.priceVerifiedAt).toLocaleDateString() : "—"}
                    </td>
                    <td className="p-3">{row.stockStatus.replaceAll("_", " ")}</td>
                    <td className="p-3 text-xs">{row.publicSourceLabel ?? "—"}</td>
                    <td className="p-3">
                      <Link
                        href={`/admin/products/${row.id}`}
                        className="text-sm font-bold underline"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
