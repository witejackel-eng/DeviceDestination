import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getCachedCatalogue } from "@/data/catalogue-cache";
import { deriveBrands } from "@/lib/catalogue-view";
import { CatalogueUnavailable, CatalogueUnverifiedNotice } from "@/components/catalogue-state";

// Brand counts must reflect the database, so this renders per request with the
// cached catalogue behind it rather than being prerendered from fallback data.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Shop security hardware by brand",
  description: "Browse exact-model CP Plus, eSSL, NETGEAR and Prama hardware.",
  alternates: { canonical: "/brands" },
};

export default async function BrandsPage() {
  const snapshot = await getCachedCatalogue();
  const brands = deriveBrands(snapshot.products);
  const authoritativeEmpty = snapshot.authority === "database" && snapshot.products.length === 0;

  return (
    <div className="container-standard section-space !pt-14">
      <p className="eyebrow">Shop by brand</p>
      <h1 className="display-section mt-4">Find the exact manufacturer.</h1>
      <p className="mt-5 max-w-2xl text-lg leading-8 text-[var(--text-muted)]">
        Every brand page contains only real catalogue products, exact model numbers and available
        technical documents.
      </p>
      {snapshot.authority === "static_degraded" && (
        <CatalogueUnverifiedNotice className="mt-6 max-w-2xl" />
      )}

      {authoritativeEmpty ? (
        <CatalogueUnavailable className="mt-12" />
      ) : (
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {brands.map((brand) => {
            const count = snapshot.products.filter(
              (product) => product.brandSlug === brand.slug,
            ).length;
            return (
              <Link
                key={brand.slug}
                href={`/brands/${brand.slug}`}
                className="group rounded-[24px] border border-[var(--border)] bg-white p-7 transition-colors hover:border-[var(--accent-border-hover)]"
              >
                <p className="text-sm text-[var(--text-muted)]">
                  {count} {count === 1 ? "product" : "products"}
                </p>
                <h2 className="mt-12 font-display text-4xl font-bold">{brand.name}</h2>
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold">
                  Shop brand{" "}
                  <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
