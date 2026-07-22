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
import { ProductSearch } from "@/components/product-search";
import { HeroProducts } from "@/components/hero-products";
import { HomeMotion } from "@/components/home-motion";
import { publicPageMetadata } from "@/lib/seo";

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

export default function Home() {
  const heroProducts = [
    catalogue.find((product) => product.model === "CP-UNC-DA41L3C-D-Q"),
    catalogue.find((product) => product.model === "CP-UNR-108F1"),
    catalogue.find((product) => product.model === "AiFace Mercury"),
    catalogue.find((product) => product.model === "GS108PP"),
  ].flatMap((product) => (product ? [product] : []));
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
  const collections = [
    {
      title: "Cameras under ₹3,000",
      copy: "Affordable 2MP cameras for indoor and outdoor coverage.",
      href: "/products?q=camera&sort=price-low",
      count: catalogue.filter(
        (product) =>
          product.categorySlug.includes("camera") &&
          (product.sellingPriceInclGstPaise ?? Infinity) < 300_000,
      ).length,
      color: "var(--peach)",
    },
    {
      title: "Popular biometric devices",
      copy: "Face and fingerprint attendance hardware by exact model.",
      href: "/categories/biometric-devices",
      count: catalogue.filter((product) => product.categorySlug === "biometric-devices").length,
      color: "var(--sky)",
    },
    {
      title: "PoE networking essentials",
      copy: "Switches for powering compatible cameras and endpoints.",
      href: "/categories/poe-switches",
      count: catalogue.filter((product) => product.categorySlug === "poe-switches").length,
      color: "var(--sage)",
    },
  ].filter((collection) => collection.count > 0);
  const liveBrands = brands.filter((brand) =>
    catalogue.some((product) => product.brandSlug === brand.slug),
  );

  return (
    <>
      <HomeMotion />

      <section data-commerce-hero className="overflow-hidden border-b border-[var(--line)]">
        <div className="container-standard grid items-center gap-9 py-10 sm:py-12 lg:min-h-[660px] lg:grid-cols-[0.94fr_1.06fr] lg:py-8">
          <div className="relative z-20">
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
            <h1 data-hero-copy className="display-hero mt-6">
              Security hardware.
              <br />
              <span className="relative inline-block">
                Find the exact model.
                <span
                  className="absolute inset-x-0 -bottom-1 h-2 bg-[var(--tangerine)]"
                  aria-hidden="true"
                />
              </span>
            </h1>
            <p data-hero-copy className="mt-7 max-w-xl text-lg leading-8 text-[var(--muted)]">
              Shop cameras, recorders, biometric devices and networking hardware with clear prices
              and model-specific documents.
            </p>
            <div data-hero-copy className="mt-7 max-w-xl">
              <ProductSearch mode="hero" />
            </div>
            <div data-hero-copy className="mt-6 flex flex-wrap gap-3">
              <Link href="/products" className="button-primary">
                Shop all products <ArrowRight size={17} />
              </Link>
              <Link href="/compare" className="button-secondary">
                Compare models <Scale size={17} />
              </Link>
            </div>
            <p data-hero-copy className="mt-5 text-sm font-semibold text-[var(--muted)]">
              GST-inclusive pricing · Exact-model documentation · Secure checkout
            </p>
          </div>
          <HeroProducts products={heroProducts} />
        </div>
      </section>

      <section className="py-16 sm:py-20 lg:py-24" data-gsap-categories>
        <div className="container-standard">
          <div>
            <p className="eyebrow">Shop by category</p>
            <h2 className="display-section mt-4">Start with the hardware.</h2>
          </div>
          <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {orderedCategories.map((category) => {
              const products = catalogue.filter(
                (product) => product.categorySlug === category.slug,
              );
              const example = products[0];
              return (
                <Link
                  key={category.slug}
                  href={`/categories/${category.slug}`}
                  data-home-category
                  className="group overflow-hidden rounded-[22px] border border-[var(--line)] bg-white transition-colors hover:border-[var(--tangerine-border-hover)]"
                >
                  <div className="relative aspect-[1.55] bg-[var(--canvas-alt)]">
                    <Image
                      src={example.images[0]}
                      alt={`${category.name} example`}
                      fill
                      sizes="(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 25vw"
                      className="object-contain p-4 transition-transform duration-500 group-hover:scale-[1.04]"
                    />
                  </div>
                  <div className="p-5">
                    <p className="text-xs text-[var(--muted)]">
                      {products.length} {products.length === 1 ? "product" : "products"}
                    </p>
                    <h3 className="mt-2 font-display text-2xl font-semibold">{category.name}</h3>
                    <span className="mt-4 inline-flex items-center gap-2 text-sm font-bold">
                      Shop category
                      <ArrowRight
                        size={15}
                        className="transition-transform group-hover:translate-x-1"
                      />
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section
        className="border-y border-[var(--line)] bg-[var(--canvas-alt)] py-16 sm:py-20 lg:py-24"
        data-gsap-products
      >
        <div className="container-standard">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="eyebrow">Popular products</p>
              <h2 className="display-section mt-4">Popular exact models.</h2>
            </div>
            <Link href="/products" className="button-secondary">
              Browse all products
            </Link>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {popularProducts.map((product) => (
              <ProductCard key={product.id} product={product} compact />
            ))}
          </div>
        </div>
      </section>

      <section className="py-14 sm:py-16 lg:py-20">
        <div className="container-standard">
          <p className="eyebrow">Curated shopping</p>
          <h2 className="display-section mt-4">Popular collections.</h2>
          <div className="mt-9 grid gap-4 md:grid-cols-3">
            {collections.map((collection) => (
              <Link
                key={collection.title}
                href={collection.href}
                data-home-collection
                className="group rounded-[24px] border border-[var(--line)] p-6 sm:p-7"
                style={{ background: collection.color }}
              >
                <p className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--muted)]">
                  {collection.count} matching products
                </p>
                <h3 className="mt-8 font-display text-3xl font-semibold">{collection.title}</h3>
                <p className="mt-3 leading-7 text-[var(--muted)]">{collection.copy}</p>
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold">
                  Shop collection
                  <ArrowRight
                    size={15}
                    className="transition-transform group-hover:translate-x-1"
                  />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section
        className="overflow-hidden bg-[var(--ink)] py-16 text-white sm:py-20"
        data-gsap-compare
      >
        <div className="container-standard grid items-center gap-10 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="eyebrow !text-white/55">Compare models</p>
            <h2 className="display-section mt-4">Not sure which model is right?</h2>
            <p className="mt-5 max-w-xl text-lg leading-8 text-white/65">
              Compare resolution, night vision, audio, PoE, weather resistance and warranty side by
              side.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/compare" className="button-primary">
                Compare products <Scale size={17} />
              </Link>
              <Link
                href="/contact"
                className="button-secondary !border-white/20 !bg-white/10 !text-white"
              >
                Get product help <MessageCircle size={17} />
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {compareProducts.map((product) => (
              <Link
                key={product.id}
                href={`/products/${product.slug}`}
                className="rounded-[20px] border border-white/12 bg-white/[0.06] p-2.5 sm:p-3"
              >
                <div className="relative aspect-square rounded-2xl bg-white">
                  <Image
                    src={product.images[0]}
                    alt={`${product.brand} ${product.model}`}
                    fill
                    sizes="(max-width: 768px) 30vw, 220px"
                    className="object-contain p-2 sm:p-4"
                  />
                </div>
                <p className="mt-3 truncate text-[10px] font-bold text-[var(--tangerine)] sm:text-sm">
                  {product.model}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-[var(--line)] py-12 sm:py-14" data-home-brands-trust>
        <div className="container-standard">
          <div className="flex flex-wrap items-center gap-3">
            <p className="eyebrow mr-auto">Shop by brand</p>
            {liveBrands.map((brand) => (
              <Link
                key={brand.slug}
                href={`/brands/${brand.slug}`}
                className="flex min-h-11 items-center rounded-full border border-[var(--line)] bg-white px-5 font-display text-lg font-bold transition-colors hover:border-[var(--tangerine-border-hover)]"
              >
                {brand.name}
              </Link>
            ))}
          </div>
          <div className="mt-8 grid gap-4 border-t border-[var(--line)] pt-8 sm:grid-cols-2 xl:grid-cols-4">
            {[
              [IndianRupee, "GST-inclusive pricing"],
              [FileText, "Exact-model documents"],
              [BadgeCheck, "OEM warranty where applicable"],
              [CreditCard, "Secure Razorpay checkout"],
            ].map(([Icon, label]) => {
              const I = Icon as typeof BadgeCheck;
              return (
                <div
                  key={label as string}
                  className="flex min-h-11 items-center gap-3 text-sm font-bold"
                >
                  <I size={20} className="text-[var(--tangerine-text)]" /> {label as string}
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}
