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
  Search,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { brands, catalogue, categories, searchProducts } from "@/data/catalog";
import { ProductCard } from "@/components/product-card";
import { ProductSearch } from "@/components/product-search";
import { HeroProducts } from "@/components/hero-products";
import { HomeMotion } from "@/components/home-motion";
import { RecentlyViewed } from "@/components/recently-viewed";
import { publicPageMetadata } from "@/lib/seo";
import { siteConfig } from "@/config/site";

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

const useCases = [
  ["Home", "home-security"],
  ["Shop", "retail-shops"],
  ["Office", "offices"],
  ["Warehouse", "warehouses"],
  ["School", "schools"],
  ["Apartment society", "apartments"],
] as const;

export default function Home() {
  const heroProducts = [
    catalogue.find((product) => product.model === "CP-UNC-DA41L3C-D-Q"),
    catalogue.find((product) => product.model === "CP-UNC-TA41L3C-Q"),
    catalogue.find((product) => product.model === "CP-UNR-108F1"),
    catalogue.find((product) => product.model === "AiFace Mercury"),
    catalogue.find((product) => product.model === "GS108PP"),
    catalogue.find((product) => product.model === "F22+ID+WIFI"),
  ].flatMap((product) => (product ? [product] : []));
  const orderedCategories = categoryOrder.flatMap((slug) => {
    const category = categories.find((item) => item.slug === slug);
    return category ? [category] : [];
  });
  const bestSellers = catalogue.filter((product) => product.stockStatus === "in_stock").slice(0, 8);
  const compareProducts = catalogue
    .filter((product) => product.categorySlug.includes("camera"))
    .slice(0, 3);
  const collections = [
    {
      title: "Cameras under ₹3,000",
      copy: "Exact-model 2MP cameras with GST-inclusive pricing.",
      href: "/products?price=under-5000&q=2MP",
      count: catalogue.filter(
        (product) =>
          product.categorySlug.includes("camera") &&
          (product.sellingPriceInclGstPaise ?? Infinity) < 300_000,
      ).length,
      color: "var(--peach)",
    },
    {
      title: "4MP camera range",
      copy: "Compare dome, bullet, IR and full-color options.",
      href: "/products?q=4MP+camera",
      count: searchProducts("4MP camera").length,
      color: "var(--sage)",
    },
    {
      title: "Popular biometrics",
      copy: "Face and fingerprint attendance hardware by exact model.",
      href: "/categories/biometric-devices",
      count: catalogue.filter((product) => product.categorySlug === "biometric-devices").length,
      color: "var(--sky)",
    },
    {
      title: "PoE networking",
      copy: "Power compatible cameras and network endpoints cleanly.",
      href: "/categories/poe-switches",
      count: catalogue.filter((product) => product.categorySlug === "poe-switches").length,
      color: "var(--sand)",
    },
  ].filter((collection) => collection.count > 0);

  return (
    <>
      <HomeMotion />
      <section data-commerce-hero className="overflow-hidden border-b border-[var(--line)]">
        <div className="container-standard grid min-h-[calc(100svh-140px)] items-center gap-10 py-12 lg:grid-cols-[0.92fr_1.08fr] lg:py-10">
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
                30 exact models ready to shop
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
            <p data-hero-copy className="mt-8 max-w-xl text-lg leading-8 text-[var(--muted)]">
              Shop exact-model cameras, recorders, biometric devices and networking hardware with
              GST-inclusive pricing and model-specific documentation.
            </p>
            <div data-hero-copy className="mt-7 max-w-xl">
              <ProductSearch mode="hero" />
              <p className="mt-3 text-xs text-[var(--muted)]">
                Try CP-UNC-DA41L3C-D-Q, 4MP dome camera, 8-channel NVR or PoE switch.
              </p>
            </div>
            <div data-hero-copy className="mt-7 flex flex-wrap gap-3">
              <Link href="/products" className="button-primary">
                Shop all products <ArrowRight size={17} />
              </Link>
              <Link href="/compare" className="button-secondary">
                Compare models <Scale size={17} />
              </Link>
            </div>
            <p data-hero-copy className="mt-6 text-sm font-semibold text-[var(--muted)]">
              Available products · Guest checkout · GST invoice · Secure Razorpay payment
            </p>
          </div>
          <HeroProducts products={heroProducts} />
        </div>
      </section>

      <section className="section-space !pb-20" data-gsap-reveal>
        <div className="container-standard">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="eyebrow">Shop by category</p>
              <h2 className="display-section mt-4">Start with the hardware.</h2>
            </div>
            <Link href="/products" className="button-secondary">
              View all 30 products
            </Link>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {orderedCategories.map((category) => {
              const products = catalogue.filter(
                (product) => product.categorySlug === category.slug,
              );
              const example = products[0];
              return (
                <Link
                  key={category.slug}
                  href={`/categories/${category.slug}`}
                  className="group overflow-hidden rounded-[22px] border border-[var(--line)] bg-white transition-colors hover:border-[var(--tangerine-border-hover)]"
                >
                  <div className="relative aspect-[1.35] bg-[var(--canvas-alt)]">
                    <Image
                      src={example.images[0]}
                      alt={`${category.name} example`}
                      fill
                      sizes="(max-width: 768px) 90vw, 25vw"
                      className="object-contain p-5 transition-transform duration-500 group-hover:scale-[1.04]"
                    />
                  </div>
                  <div className="p-5">
                    <p className="text-xs text-[var(--muted)]">
                      {products.length} {products.length === 1 ? "product" : "products"}
                    </p>
                    <h3 className="mt-2 font-display text-2xl font-semibold">{category.name}</h3>
                    <span className="mt-4 inline-flex items-center gap-2 text-sm font-bold">
                      Shop category{" "}
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
        className="section-space border-y border-[var(--line)] bg-[var(--canvas-alt)]"
        data-gsap-reveal
      >
        <div className="container-standard">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="eyebrow">Best sellers</p>
              <h2 className="display-section mt-4">Popular exact models.</h2>
            </div>
            <Link href="/products?sort=price-low" className="button-secondary">
              Browse by price
            </Link>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {bestSellers.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>

      <section className="section-space !pb-16" data-gsap-reveal>
        <div className="container-standard">
          <div className="grid gap-6 lg:grid-cols-[0.7fr_1.3fr]">
            <div>
              <p className="eyebrow">Shop for your space</p>
              <h2 className="display-section mt-4">A faster starting point.</h2>
            </div>
            <p className="max-w-2xl self-end text-lg leading-8 text-[var(--muted)]">
              Open the CCTV kit builder with a useful starting filter, then choose purchasable
              products.
            </p>
          </div>
          <div className="mt-9 flex flex-wrap gap-3">
            {useCases.map(([label, property]) => (
              <Link
                key={property}
                href={`/system-builder?property=${property}`}
                className="button-secondary rounded-full"
              >
                {label} <ArrowRight size={15} />
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section-space !pt-16" data-gsap-reveal>
        <div className="container-standard">
          <p className="eyebrow">Featured collections</p>
          <h2 className="display-section mt-4">Shop a useful shortlist.</h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {collections.map((collection) => (
              <Link
                key={collection.title}
                href={collection.href}
                className="group min-h-[260px] rounded-[24px] border border-[var(--line)] p-7"
                style={{ background: collection.color }}
              >
                <p className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--muted)]">
                  {collection.count} matching products
                </p>
                <h3 className="mt-16 font-display text-3xl font-semibold">{collection.title}</h3>
                <p className="mt-3 leading-7 text-[var(--muted)]">{collection.copy}</p>
                <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold">
                  Shop collection{" "}
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
        className="section-space overflow-hidden bg-[var(--ink)] text-white"
        data-gsap-reveal
      >
        <div className="container-standard grid items-center gap-12 lg:grid-cols-[0.86fr_1.14fr]">
          <div>
            <p className="eyebrow !text-white/55">Compare exact models</p>
            <h2 className="display-section mt-4">Not sure which model is right?</h2>
            <p className="mt-6 max-w-xl text-lg leading-8 text-white/65">
              Compare resolution, lens, night vision, audio, weather resistance, PoE and warranty
              side by side.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/compare" className="button-primary">
                Compare products <Scale size={17} />
              </Link>
              <Link
                href="/products?q=camera"
                className="button-secondary !border-white/20 !bg-white/10 !text-white"
              >
                Browse cameras
              </Link>
              <Link href="/system-builder" className="button-quiet !text-white">
                Build a CCTV kit <Wrench size={16} />
              </Link>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {compareProducts.map((product, index) => (
              <div
                key={product.id}
                className="rounded-[22px] border border-white/12 bg-white/[0.06] p-3"
              >
                <div className="relative aspect-square rounded-2xl bg-white">
                  <Image
                    src={product.images[0]}
                    alt={`${product.brand} ${product.model}`}
                    fill
                    sizes="220px"
                    className="object-contain p-4"
                  />
                </div>
                <p className="mt-4 text-xs font-bold text-[var(--tangerine)]">0{index + 1}</p>
                <p className="mt-1 font-display text-lg font-semibold">{product.model}</p>
                <p className="mt-2 text-xs leading-5 text-white/55">
                  {product.highlights.slice(0, 2).join(" · ")}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section-space !pb-16" data-gsap-reveal>
        <div className="container-standard">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="eyebrow">Shop by brand</p>
              <h2 className="display-section mt-4">Hardware you can identify.</h2>
            </div>
            <Link href="/brands" className="button-secondary">
              All brands
            </Link>
          </div>
          <div className="mt-10 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {brands.map((brand) => {
              const count = catalogue.filter((product) => product.brandSlug === brand.slug).length;
              return (
                <Link
                  key={brand.slug}
                  href={`/brands/${brand.slug}`}
                  className="rounded-[20px] border border-[var(--line)] bg-white p-6 transition-colors hover:border-[var(--tangerine-border-hover)]"
                >
                  <p className="font-display text-2xl font-bold">{brand.name}</p>
                  <p className="mt-2 text-sm text-[var(--muted)]">{count} exact models</p>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section
        className="border-y border-[var(--line)] bg-[var(--tangerine-soft)] py-8"
        data-gsap-reveal
      >
        <div className="container-standard grid gap-6 sm:grid-cols-2 xl:grid-cols-5">
          {[
            [IndianRupee, "GST-inclusive pricing"],
            [FileText, "Exact-model documents"],
            [BadgeCheck, "OEM warranty where applicable"],
            [CreditCard, "Secure Razorpay checkout"],
            [ShieldCheck, `${siteConfig.serviceArea} support`],
          ].map(([Icon, label]) => {
            const I = Icon as typeof BadgeCheck;
            return (
              <div key={label as string} className="flex items-center gap-3 text-sm font-bold">
                <I size={20} /> {label as string}
              </div>
            );
          })}
        </div>
      </section>

      <RecentlyViewed />

      <section className="section-space" data-gsap-reveal>
        <div className="container-standard rounded-[30px] bg-[var(--tangerine)] p-8 text-[var(--ink)] sm:p-14 lg:p-20">
          <Search size={34} />
          <h2 className="mt-8 max-w-5xl font-display text-[clamp(3rem,7vw,7rem)] font-semibold leading-[0.92] tracking-[-0.065em]">
            Know the model? Find it in seconds.
          </h2>
          <div className="mt-8 max-w-2xl">
            <ProductSearch mode="hero" />
          </div>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/products"
              className="button-secondary !border-transparent !bg-[var(--ink)] !text-white"
            >
              Shop all products
            </Link>
            <a
              href={`https://wa.me/${siteConfig.contact.whatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              className="button-secondary !border-[rgb(23_20_17/0.3)] !bg-transparent"
            >
              <MessageCircle size={17} /> WhatsApp product help
            </a>
            <a href={`tel:${siteConfig.contact.phoneE164}`} className="button-quiet">
              Call {siteConfig.contact.phoneDisplay}
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
