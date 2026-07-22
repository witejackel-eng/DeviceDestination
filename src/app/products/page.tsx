import type { Metadata } from "next";
import Link from "next/link";
import { X } from "lucide-react";
import { catalogue, brands, categories, searchProducts } from "@/data/catalog";
import { ProductCard } from "@/components/product-card";
import { CatalogueToolbar } from "@/components/catalogue-toolbar";

export const metadata: Metadata = {
  title: "Security and biometric products",
  description:
    "Browse CCTV cameras, NVRs and biometric products by exact model, category and brand.",
  alternates: { canonical: "/products" },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function resolutionOf(product: (typeof catalogue)[number]) {
  const value =
    `${product.model} ${product.specs["Max Resolution"] ?? ""} ${product.specs["Max resolution"] ?? ""}`.toLowerCase();
  if (/\b6\s?mp\b|3200\s*[×x]\s*1800/.test(value)) return "6mp";
  if (/\b4\s?mp\b|2560\s*[×x]\s*1440|2688\s*[×x]\s*1520/.test(value)) return "4mp";
  if (/\b2\s?mp\b|1920\s*[×x]\s*1080/.test(value)) return "2mp";
  return "";
}

function authenticationOf(product: (typeof catalogue)[number]) {
  const value = `${product.specs.Authentication ?? ""} ${product.title}`.toLowerCase();
  if (value.includes("face")) return "face";
  if (value.includes("fingerprint")) return "fingerprint";
  return "";
}

export default async function ProductsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";
  const category = typeof params.category === "string" ? params.category : "";
  const brand = typeof params.brand === "string" ? params.brand : "";
  const sort = typeof params.sort === "string" ? params.sort : "relevance";
  const resolution = typeof params.resolution === "string" ? params.resolution : "";
  const poe = typeof params.poe === "string" ? params.poe : "";
  const availability = typeof params.availability === "string" ? params.availability : "";
  const price = typeof params.price === "string" ? params.price : "";
  const authentication = typeof params.authentication === "string" ? params.authentication : "";

  const queryMatches = new Set(searchProducts(q).map((product) => product.id));
  let products = catalogue.filter((product) => {
    return (
      (!q || queryMatches.has(product.id)) &&
      (!category || product.categorySlug === category) &&
      (!brand || product.brandSlug === brand) &&
      (!resolution || resolutionOf(product) === resolution) &&
      (!poe ||
        (poe === "yes"
          ? /poe/i.test(Object.values(product.specs).join(" "))
          : !/poe/i.test(Object.values(product.specs).join(" ")))) &&
      (!authentication || authenticationOf(product) === authentication) &&
      (!availability ||
        (availability === "buy-now"
          ? product.priceSourceStatus === "verified" && product.stockStatus === "in_stock"
          : product.priceSourceStatus !== "verified" || product.stockStatus !== "in_stock")) &&
      (!price ||
        (price === "under-5000"
          ? (product.sellingPriceInclGstPaise ?? Infinity) < 500_000
          : price === "5000-15000"
            ? (product.sellingPriceInclGstPaise ?? 0) >= 500_000 &&
              (product.sellingPriceInclGstPaise ?? Infinity) <= 1_500_000
            : (product.sellingPriceInclGstPaise ?? 0) > 1_500_000))
    );
  });

  const selectedCategory = categories.find((item) => item.slug === category)?.name ?? "";
  const cameraContext = !category || /camera/i.test(selectedCategory);
  const biometricContext = !category || /biometric/i.test(selectedCategory);
  const poeContext = !category || /camera|switch/i.test(selectedCategory);

  products = [...products].sort((a, b) => {
    if (sort === "price-low")
      return (a.sellingPriceInclGstPaise ?? Infinity) - (b.sellingPriceInclGstPaise ?? Infinity);
    if (sort === "price-high")
      return (b.sellingPriceInclGstPaise ?? 0) - (a.sellingPriceInclGstPaise ?? 0);
    if (sort === "newest") return b.verifiedAt.localeCompare(a.verifiedAt);
    return a.model.localeCompare(b.model);
  });

  /* Active filter chips */
  const activeFilters: { label: string; clearHref: string }[] = [];
  if (q) activeFilters.push({ label: `Search: ${q}`, clearHref: "/products" });
  if (category) {
    const cat = categories.find((c) => c.slug === category);
    if (cat) activeFilters.push({ label: cat.name, clearHref: buildClearHref(params, "category") });
  }
  if (brand) {
    const b = brands.find((br) => br.slug === brand);
    if (b) activeFilters.push({ label: b.name, clearHref: buildClearHref(params, "brand") });
  }
  if (price) {
    const priceLabel: Record<string, string> = { "under-5000": "Under ₹5,000", "5000-15000": "₹5K–₹15K", "over-15000": "Over ₹15,000" };
    activeFilters.push({ label: priceLabel[price] ?? price, clearHref: buildClearHref(params, "price") });
  }
  if (availability) {
    activeFilters.push({ label: availability === "buy-now" ? "Available now" : "Quote only", clearHref: buildClearHref(params, "availability") });
  }

  const filterParams = { q, category, brand, sort, resolution, poe, availability, price, authentication, cameraContext, biometricContext, poeContext, allCategories: categories, allBrands: brands };

  return (
    <div className="container-standard pt-10 pb-16 sm:pt-12 sm:pb-20">
      {/* ── Page header ──────────────────────────────────────── */}
      <div className="max-w-3xl mb-8">
        <p className="eyebrow">Exact-model catalogue</p>
        <h1 className="display-product-listing mt-3">Find the right hardware.</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--ink-soft)]">
          Search by model number or narrow by brand and category. Every displayed price already
          includes GST.
        </p>
      </div>

      {/* ── Filter toolbar ──────────────────────────────────── */}
      <CatalogueToolbar {...filterParams} />

      {/* ── Active filters ──────────────────────────────────── */}
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mt-4">
          {activeFilters.map((filter) => (
            <Link
              key={filter.label}
              href={filter.clearHref}
              className="filter-pill filter-pill--active inline-flex items-center gap-1.5"
            >
              {filter.label}
              <X size={12} />
            </Link>
          ))}
          <Link href="/products" className="text-sm font-semibold text-[var(--muted)] hover:text-[var(--ink)] transition-colors">
            Clear all
          </Link>
        </div>
      )}

      {/* ── Product grid ────────────────────────────────────── */}
      <section aria-labelledby="results-title" className="mt-8">
        <h2 id="results-title" className="sr-only">
          {products.length} {products.length === 1 ? "product" : "products"}
        </h2>

        <div className="flex items-center justify-between mb-6">
          <p className="text-sm font-bold text-[var(--muted)]">
            {products.length} {products.length === 1 ? "product" : "products"}
          </p>
        </div>

        {products.length > 0 ? (
          <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(220px,1fr))]">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="surface-card grid min-h-[360px] place-content-center p-8 text-center">
            <h2 className="font-display text-3xl font-semibold">No exact match.</h2>
            <p className="mt-3 text-[var(--muted)]">
              Check the model spelling or clear the filters.
            </p>
            <Link href="/products" className="button-primary mt-6">
              Clear filters
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}

function buildClearHref(
  params: Record<string, string | string[] | undefined>,
  key: string,
): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (k !== key && typeof v === "string" && v) {
      usp.set(k, v);
    }
  }
  const qs = usp.toString();
  return qs ? `/products?${qs}` : "/products";
}
