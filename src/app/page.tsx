import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  CreditCard,
  FileText,
  IndianRupee,
  MessageCircle,
  Scale,
} from "lucide-react";
import { brands, catalogue, categories } from "@/data/catalog";
import { ProductCard } from "@/components/product-card";
import { HomeMotion } from "@/components/home-motion";
import { CategoryIllustration } from "@/components/category-illustration";
import { publicPageMetadata } from "@/lib/seo";
import { formatPrice, getPurchaseEligibility } from "@/lib/products";
import { getPriceMaxAgeDays } from "@/config/site";

export const metadata: Metadata = publicPageMetadata({
  title: "Shop CCTV, biometric and networking hardware",
  description:
    "Find exact-model CCTV cameras, NVRs, biometric devices and PoE switches with GST-inclusive prices and model-specific documents.",
  path: "/",
});

const categoryOrder = [
  "dome-cameras",
  "bullet-cameras",
  "color-dome-cameras",
  "color-bullet-cameras",
  "nvr-systems",
  "biometric-devices",
  "poe-switches",
];

const categoryColors: Record<string, string> = {
  "dome-cameras": "var(--powder-blue-soft)",
  "bullet-cameras": "var(--butter-soft)",
  "color-dome-cameras": "var(--coral-soft)",
  "color-bullet-cameras": "var(--peach)",
  "nvr-systems": "var(--lilac-soft)",
  "biometric-devices": "var(--mint-soft)",
  "poe-switches": "var(--technical-grey)",
};

/* Asymmetric grid spans for 4 primary groups */
const categoryGridSpans: Record<string, string> = {
  "dome-cameras": "sm:col-span-2 sm:row-span-2",      /* Large cameras panel */
  "bullet-cameras": "sm:col-span-1 sm:row-span-1",
  "color-dome-cameras": "sm:col-span-1 sm:row-span-1",
  "color-bullet-cameras": "sm:col-span-1 sm:row-span-1",
  "nvr-systems": "sm:col-span-1 sm:row-span-1",
  "biometric-devices": "sm:col-span-1 sm:row-span-2",  /* Tall biometric panel */
  "poe-switches": "sm:col-span-1 sm:row-span-1",
};

export default function Home() {
  const orderedCategories = categoryOrder.flatMap((slug) => {
    const category = categories.find((item) => item.slug === slug);
    return category ? [category] : [];
  });
  const popularProducts = catalogue
    .filter((product) => product.stockStatus === "in_stock")
    .slice(0, 8);
  const compareProducts = catalogue
    .filter((product) => product.categorySlug.includes("camera"))
    .slice(0, 3);
  const liveBrands = brands.filter((brand) =>
    catalogue.some((product) => product.brandSlug === brand.slug),
  );

  /* NVR product for hero */
  const nvrProduct = catalogue.find((p) => p.categorySlug === "nvr-systems");
  const biometricProduct = catalogue.find((p) => p.categorySlug === "biometric-devices");
  const poeProduct = catalogue.find((p) => p.categorySlug === "poe-switches");

  return (
    <>
      <HomeMotion />

      {/* ═══════════════════════════════════════════════════════
          SECTION 1 — HERO
          ═══════════════════════════════════════════════════════ */}
      <section
        data-commerce-hero
        className="relative overflow-hidden"
        style={{ background: "var(--coral-soft)" }}
      >
        <div className="container-standard py-16 sm:py-20 lg:min-h-[88vh] lg:py-0 lg:flex lg:items-center lg:gap-0">
          <div className="relative z-20 lg:max-w-[54%] lg:pr-10" data-hero-copy-area>
            <div
              data-hero-copy
              className="inline-flex items-center overflow-hidden rounded-full border border-[var(--line)] bg-[var(--ink)] text-white"
            >
              <span
                data-anime-hero-mark
                className="bg-[var(--tangerine)] px-3 py-2 text-xs font-black tracking-[-0.04em] text-[var(--ink)]"
              >
                DD
              </span>
              <span className="px-4 py-2 text-[10px] font-bold uppercase tracking-[0.15em] text-white/75">
                Exact-model security hardware
              </span>
            </div>

            <h1 data-hero-copy className="display-hero mt-6 text-[var(--ink)]">
              Security hardware,
              <br />
              without the guesswork.
            </h1>

            <p data-hero-copy className="mt-7 max-w-xl text-lg leading-8 text-[var(--ink-soft)]">
              Find the exact camera, recorder, biometric device or network component — with clear
              pricing, model-specific documents, and secure checkout.
            </p>

            <div data-hero-copy className="mt-8 flex flex-wrap gap-3">
              <Link href="/products" className="button-primary">
                Shop products <ArrowRight size={16} />
              </Link>
              <Link href="/compare" className="button-secondary">
                Compare models <Scale size={16} />
              </Link>
            </div>

            <p data-hero-copy className="mt-5 flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold text-[var(--ink-soft)]">
              <span>GST-inclusive pricing</span>
              <span className="hidden sm:inline">·</span>
              <span>Model-specific documents</span>
              <span className="hidden sm:inline">·</span>
              <span>Secure checkout</span>
            </p>
          </div>

          {/* Hero product composition */}
          <div className="relative mt-10 hidden lg:block lg:mt-0 lg:w-[46%]" data-hero-composition>
            <div
              className="grid grid-cols-4 grid-rows-4 gap-3"
              style={{ height: "520px" }}
              aria-label="Illustrated CCTV, recording, biometric and networking hardware"
            >
              {/* Product 1 — Large dome camera */}
              <div
                data-hero-product
                className="col-span-2 row-span-2 relative overflow-hidden rounded-[24px] border border-[var(--line)] bg-white"
              >
                <Image
                  src={compareProducts[0]?.images[0] ?? "/images/placeholder.png"}
                  alt=""
                  fill
                  sizes="300px"
                  className="object-contain p-8"
                />
              </div>
              {/* Product 2 — Bullet camera */}
              <div
                data-hero-product
                className="col-span-2 row-span-2 relative overflow-hidden rounded-[24px] border border-[var(--line)]"
                style={{ background: "var(--butter-soft)" }}
              >
                <Image
                  src={compareProducts[1]?.images[0] ?? "/images/placeholder.png"}
                  alt=""
                  fill
                  sizes="300px"
                  className="object-contain p-8"
                />
              </div>
              {/* Product 3 — NVR */}
              <div
                data-hero-product
                className="col-span-1 row-span-2 relative overflow-hidden rounded-[24px] border border-[var(--line)]"
                style={{ background: "var(--lilac-soft)" }}
              >
                <Image
                  src={nvrProduct?.images[0] ?? "/images/placeholder.png"}
                  alt=""
                  fill
                  sizes="150px"
                  className="object-contain p-6"
                />
              </div>
              {/* Product 4 — Biometric */}
              <div
                data-hero-product
                className="col-span-1 row-span-1 relative overflow-hidden rounded-[24px] border border-[var(--line)]"
                style={{ background: "var(--mint-soft)" }}
              >
                <Image
                  src={biometricProduct?.images[0] ?? "/images/placeholder.png"}
                  alt=""
                  fill
                  sizes="150px"
                  className="object-contain p-4"
                />
              </div>
              {/* Decorative DD shape */}
              <div
                className="col-span-1 row-span-1 rounded-[24px] border border-[var(--line)] bg-[var(--tangerine)]"
              >
                <div className="flex h-full w-full items-center justify-center">
                  <span className="font-display text-3xl font-bold text-[var(--ink)]">DD</span>
                </div>
              </div>
              {/* Product 5 — Networking */}
              <div
                data-hero-product
                className="col-span-2 row-span-2 relative overflow-hidden rounded-[24px] border border-[var(--line)]"
                style={{ background: "var(--powder-blue-soft)" }}
              >
                <Image
                  src={poeProduct?.images[0] ?? "/images/placeholder.png"}
                  alt=""
                  fill
                  sizes="300px"
                  className="object-contain p-8"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          SECTION 2 — CATEGORY DISCOVERY
          ═══════════════════════════════════════════════════════ */}
      <section
        className="section-space"
        style={{ background: "var(--surface)" }}
        data-gsap-categories
      >
        <div className="container-standard">
          <div className="mb-10 max-w-2xl">
            <p className="eyebrow">Shop by category</p>
            <h2 className="display-section mt-3">Start with the hardware.</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-4 sm:grid-rows-3">
            {orderedCategories.map((category) => {
              const products = catalogue.filter(
                (product) => product.categorySlug === category.slug,
              );
              const spanClass = categoryGridSpans[category.slug] ?? "sm:col-span-1 sm:row-span-1";
              const bgColor = categoryColors[category.slug] ?? "var(--canvas-warm)";
              const isLarge = spanClass.includes("col-span-2") || spanClass.includes("row-span-2");

              return (
                <Link
                  key={category.slug}
                  href={`/categories/${category.slug}`}
                  data-home-category
                  className={`category-panel group flex h-full flex-col justify-between p-5 sm:p-6 ${spanClass}`}
                  style={{ background: bgColor }}
                >
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--muted)]">
                      {products.length} {products.length === 1 ? "product" : "products"}
                    </p>
                    <h3 className={`mt-2 font-display font-bold leading-tight ${isLarge ? "text-3xl sm:text-4xl" : "text-xl sm:text-2xl"}`}>
                      {category.name}
                    </h3>
                  </div>
                  <div className="mt-4">
                    <CategoryIllustration
                      slug={category.slug}
                      className={`category-panel-image ${isLarge ? "h-24 w-24 sm:h-32 sm:w-32" : "h-16 w-16 sm:h-20 sm:w-20"}`}
                    />
                  </div>
                  <span className="mt-4 inline-flex items-center gap-2 text-sm font-bold">
                    Shop category
                    <ArrowRight
                      size={14}
                      className="transition-transform group-hover:translate-x-1"
                    />
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          SECTION 3 — FEATURED PRODUCTS
          ═══════════════════════════════════════════════════════ */}
      <section
        className="section-space"
        style={{ background: "var(--canvas)" }}
        data-gsap-products
      >
        <div className="container-standard">
          <div className="flex flex-wrap items-end justify-between gap-5 mb-10">
            <div className="max-w-xl">
              <p className="eyebrow">Popular products</p>
              <h2 className="display-section mt-3">Popular exact models.</h2>
              <p className="mt-4 text-base text-[var(--ink-soft)] leading-7">
                In-stock hardware with GST-inclusive pricing and model documentation.
              </p>
            </div>
            <Link href="/products" className="button-secondary">
              View all products <ArrowRight size={16} />
            </Link>
          </div>
          <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(220px,1fr))]">
            {popularProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          SECTION 4 — COMPARE / HELP
          ═══════════════════════════════════════════════════════ */}
      <section
        className="relative overflow-hidden"
        style={{ background: "var(--lilac-soft)" }}
        data-gsap-compare
      >
        <div className="container-standard py-16 sm:py-20 lg:py-24">
          <div className="grid items-center gap-12 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <p className="eyebrow">Compare models</p>
              <h2 className="display-section mt-3 text-[var(--ink)]">
                Not sure which model is right?
              </h2>
              <p className="mt-5 max-w-xl text-lg leading-8 text-[var(--ink-soft)]">
                Compare resolution, night vision, audio, PoE, weather resistance and warranty side
                by side. Or reach out for product-specific help.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link href="/compare" className="button-primary">
                  Compare products <Scale size={16} />
                </Link>
                <Link
                  href="/contact"
                  className="button-secondary"
                >
                  Get product help <MessageCircle size={16} />
                </Link>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {compareProducts.map((product) => {
                const eligible = getPurchaseEligibility(product, { maxAgeDays: getPriceMaxAgeDays() }).eligible;
                return (
                  <Link
                    key={product.id}
                    href={`/products/${product.slug}`}
                    className="group rounded-[20px] border border-[var(--line)] bg-[var(--surface)] p-3 transition-transform duration-300 hover:scale-[1.03]"
                  >
                    <div className="relative aspect-square overflow-hidden rounded-2xl">
                      <Image
                        src={product.images[0]}
                        alt={`${product.brand} ${product.model}`}
                        fill
                        sizes="(max-width: 768px) 30vw, 220px"
                        className="object-contain p-3 sm:p-4"
                      />
                    </div>
                    <p className="mt-2 truncate text-[10px] font-bold text-[var(--tangerine-text)] sm:text-xs">
                      {product.model}
                    </p>
                    <p className="mt-0.5 truncate text-xs font-semibold text-[var(--muted)] sm:text-sm">
                      {product.brand}
                    </p>
                    {eligible && (
                      <p className="mt-1 text-xs font-bold">
                        {formatPrice(product.sellingPriceInclGstPaise)}
                      </p>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          SECTION 5 — BRAND AND TRUST CONCLUSION
          ═══════════════════════════════════════════════════════ */}
      <section
        className="border-t border-[var(--line)]"
        style={{ background: "var(--surface)" }}
        data-home-brands-trust
      >
        <div className="container-standard py-14 sm:py-16">
          <div className="flex flex-wrap items-center gap-3 mb-10">
            <p className="eyebrow mr-auto">Shop by brand</p>
            {liveBrands.map((brand) => (
              <Link
                key={brand.slug}
                href={`/brands/${brand.slug}`}
                className="flex min-h-11 items-center rounded-full border border-[var(--line)] bg-[var(--canvas)] px-5 font-display text-lg font-bold transition-colors hover:border-[var(--tangerine-border-hover)] hover:bg-[var(--tangerine-subtle)]"
              >
                {brand.name}
              </Link>
            ))}
          </div>
          <div className="grid gap-6 border-t border-[var(--line)] pt-10 sm:grid-cols-2 xl:grid-cols-4">
            {[
              [IndianRupee, "GST-inclusive pricing", "Every displayed price includes GST with clear invoice breakdown."],
              [FileText, "Exact-model documents", "Datasheets, manuals and installation guides matched to each product."],
              [BadgeCheck, "OEM warranty", "Manufacturer warranty supported where applicable, with documentation."],
              [CreditCard, "Secure Razorpay checkout", "Protected payment processing with multiple payment methods."],
            ].map(([Icon, title, desc]) => {
              const I = Icon as typeof BadgeCheck;
              return (
                <div
                  key={title as string}
                  className="surface-card p-5"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--tangerine-soft)]">
                      <I size={18} className="text-[var(--tangerine-text)]" />
                    </div>
                    <p className="font-bold">{title as string}</p>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{desc as string}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}
