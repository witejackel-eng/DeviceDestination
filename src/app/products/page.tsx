import type { Metadata } from "next";
import Link from "next/link";
import { Search, SlidersHorizontal } from "lucide-react";
import { catalogue, brands, categories, searchProducts } from "@/data/catalog";
import { ProductCard } from "@/components/product-card";

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

  const renderFilters = (prefix: "mobile" | "desktop") => (
    <form action="/products" aria-label={`${prefix} product filters`} className="grid gap-5">
      <div>
        <label htmlFor={`${prefix}-catalogue-search`} className="eyebrow">
          Search exact model
        </label>
        <div className="mt-2 flex items-center rounded-xl border border-[var(--line)] bg-white px-3">
          <Search size={17} />
          <input
            id={`${prefix}-catalogue-search`}
            name="q"
            defaultValue={q}
            placeholder="e.g. CP-UNC-DA21L3C-Q"
            className="h-12 min-w-0 flex-1 bg-transparent px-2 outline-none"
          />
        </div>
      </div>
      {cameraContext && (
        <div>
          <label htmlFor={`${prefix}-resolution`} className="eyebrow">
            Resolution
          </label>
          <select
            id={`${prefix}-resolution`}
            name="resolution"
            defaultValue={resolution}
            className="mt-2 h-12 w-full rounded-xl border border-[var(--line)] bg-white px-3"
          >
            <option value="">All resolutions</option>
            <option value="2mp">2 MP</option>
            <option value="4mp">4 MP</option>
            <option value="6mp">6 MP</option>
          </select>
        </div>
      )}
      {poeContext && (
        <div>
          <label htmlFor={`${prefix}-poe`} className="eyebrow">
            PoE
          </label>
          <select
            id={`${prefix}-poe`}
            name="poe"
            defaultValue={poe}
            className="mt-2 h-12 w-full rounded-xl border border-[var(--line)] bg-white px-3"
          >
            <option value="">Any power method</option>
            <option value="yes">PoE supported</option>
            <option value="no">Without PoE</option>
          </select>
        </div>
      )}
      {biometricContext && (
        <div>
          <label htmlFor={`${prefix}-authentication`} className="eyebrow">
            Authentication
          </label>
          <select
            id={`${prefix}-authentication`}
            name="authentication"
            defaultValue={authentication}
            className="mt-2 h-12 w-full rounded-xl border border-[var(--line)] bg-white px-3"
          >
            <option value="">All methods</option>
            <option value="face">Face recognition</option>
            <option value="fingerprint">Fingerprint</option>
          </select>
        </div>
      )}
      <div>
        <label htmlFor={`${prefix}-availability`} className="eyebrow">
          Availability
        </label>
        <select
          id={`${prefix}-availability`}
          name="availability"
          defaultValue={availability}
          className="mt-2 h-12 w-full rounded-xl border border-[var(--line)] bg-white px-3"
        >
          <option value="">All availability</option>
          <option value="buy-now">Available to buy</option>
          <option value="quote">Request price / lead time</option>
        </select>
      </div>
      <div>
        <label htmlFor={`${prefix}-price`} className="eyebrow">
          Price
        </label>
        <select
          id={`${prefix}-price`}
          name="price"
          defaultValue={price}
          className="mt-2 h-12 w-full rounded-xl border border-[var(--line)] bg-white px-3"
        >
          <option value="">Any price</option>
          <option value="under-5000">Under ₹5,000</option>
          <option value="5000-15000">₹5,000–₹15,000</option>
          <option value="over-15000">Over ₹15,000</option>
        </select>
      </div>
      <div>
        <label htmlFor={`${prefix}-category`} className="eyebrow">
          Category
        </label>
        <select
          id={`${prefix}-category`}
          name="category"
          defaultValue={category}
          className="mt-2 h-12 w-full rounded-xl border border-[var(--line)] bg-white px-3"
        >
          <option value="">All categories</option>
          {categories.map((item) => (
            <option key={item.slug} value={item.slug}>
              {item.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={`${prefix}-brand`} className="eyebrow">
          Brand
        </label>
        <select
          id={`${prefix}-brand`}
          name="brand"
          defaultValue={brand}
          className="mt-2 h-12 w-full rounded-xl border border-[var(--line)] bg-white px-3"
        >
          <option value="">All brands</option>
          {brands.map((item) => (
            <option key={item.slug} value={item.slug}>
              {item.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor={`${prefix}-sort`} className="eyebrow">
          Sort
        </label>
        <select
          id={`${prefix}-sort`}
          name="sort"
          defaultValue={sort}
          className="mt-2 h-12 w-full rounded-xl border border-[var(--line)] bg-white px-3"
        >
          <option value="relevance">Model</option>
          <option value="price-low">Price: low to high</option>
          <option value="price-high">Price: high to low</option>
          <option value="newest">Recently verified</option>
        </select>
      </div>
      <button className="button-primary w-full" type="submit">
        Apply filters
      </button>
      <Link href="/products" className="button-quiet w-full">
        Clear all
      </Link>
    </form>
  );

  return (
    <div className="container-standard section-space !pt-14">
      <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <p className="eyebrow">Exact-model catalogue</p>
          <h1 className="display-section mt-4">Find the right hardware.</h1>
        </div>
        <p className="max-w-2xl self-end text-lg leading-8 text-[var(--muted)]">
          Search by model number or narrow by brand and category. Every displayed price already
          includes GST.
        </p>
      </div>
      <details className="surface-card mt-9 p-5 lg:hidden">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 font-bold">
          <SlidersHorizontal size={18} /> Filters
        </summary>
        <div className="mt-5 border-t border-[var(--line)] pt-5">{renderFilters("mobile")}</div>
      </details>
      <div className="mt-12 grid gap-8 lg:grid-cols-[280px_1fr]">
        <aside className="hidden lg:block" aria-label="Product filters">
          <div className="sticky top-28">{renderFilters("desktop")}</div>
        </aside>
        <section aria-labelledby="results-title">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <h2 id="results-title" className="font-display text-2xl font-semibold">
              {products.length} {products.length === 1 ? "product" : "products"}
            </h2>
            {(q || category || brand) && (
              <div className="flex flex-wrap gap-2">
                {q && (
                  <span className="rounded-full bg-[var(--tangerine-soft)] px-3 py-1 text-sm">
                    Search: {q}
                  </span>
                )}
                {category && (
                  <span className="rounded-full bg-[var(--sage)] px-3 py-1 text-sm">
                    {categories.find((item) => item.slug === category)?.name}
                  </span>
                )}
                {brand && (
                  <span className="rounded-full bg-[var(--sky)] px-3 py-1 text-sm">
                    {brands.find((item) => item.slug === brand)?.name}
                  </span>
                )}
              </div>
            )}
          </div>
          {products.length > 0 ? (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
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
    </div>
  );
}
