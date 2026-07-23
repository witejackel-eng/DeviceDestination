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
  Truck,
} from "lucide-react";
import { catalogue } from "@/data/catalog";
import { ProductCard } from "@/components/product-card";
import { publicPageMetadata } from "@/lib/seo";
import { formatPrice, getPurchaseEligibility } from "@/lib/products";
import { getPriceMaxAgeDays, siteConfig } from "@/config/site";

export const metadata: Metadata = publicPageMetadata({
  title: "Shop CCTV, biometric and networking hardware",
  description:
    "Find exact-model CCTV cameras, NVRs, biometric devices and PoE switches with GST-inclusive prices and model-specific documents.",
  path: "/",
});

/* Four primary categories for section 2 */
const primaryCategories = [
  {
    slug: "dome-cameras",
    name: "CCTV Cameras",
    description: "Dome, bullet and colour models for indoor and outdoor surveillance.",
    href: "/products?q=camera",
    filterFn: (p: (typeof catalogue)[number]) => p.categorySlug.includes("camera"),
  },
  {
    slug: "nvr-systems",
    name: "NVR & Recording",
    description: "Network video recorders and storage for multi-camera setups.",
    href: "/categories/nvr-systems",
    filterFn: (p: (typeof catalogue)[number]) => p.categorySlug.includes("nvr"),
  },
  {
    slug: "biometric-devices",
    name: "Biometric Devices",
    description: "Fingerprint, face recognition and access control terminals.",
    href: "/categories/biometric-devices",
    filterFn: (p: (typeof catalogue)[number]) => p.categorySlug.includes("biometric"),
  },
  {
    slug: "poe-switches",
    name: "PoE & Networking",
    description: "Power-over-Ethernet switches and network infrastructure.",
    href: "/categories/poe-switches",
    filterFn: (p: (typeof catalogue)[number]) => p.categorySlug.includes("poe") || p.categorySlug.includes("switch"),
  },
];

export default function Home() {
  /* Featured products: up to 8 in-stock models */
  const featuredProducts = catalogue
    .filter((product) => product.stockStatus === "in_stock")
    .slice(0, 8);

  /* Compare section: max 3 camera products */
  const compareProducts = catalogue
    .filter((product) => product.categorySlug.includes("camera"))
    .slice(0, 3);

  /* Hero composition: dome, bullet, NVR/biometric */
  const domeProduct = catalogue.find((p) => p.categorySlug.includes("dome"));
  const bulletProduct = catalogue.find((p) => p.categorySlug.includes("bullet"));
  const nvrProduct = catalogue.find((p) => p.categorySlug.includes("nvr"));

  return (
    <>
      {/* ═══════════════════════════════════════════════════════
          SECTION 1 — HERO
          Clean two-column. Left: copy + search. Right: calm product composition.
          ═══════════════════════════════════════════════════════ */}
      <section style={{ background: "var(--background)" }}>
        <div className="container-standard py-16 sm:py-20 lg:min-h-[80vh] lg:py-0 lg:flex lg:items-center lg:gap-12">
          {/* Left: Copy */}
          <div className="lg:max-w-[52%]">
            <p className="eyebrow">CCTV · NVR · BIOMETRICS · NETWORKING</p>
            <h1 className="display-hero mt-5">
              Security hardware, specified clearly.
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-[var(--text-secondary)]">
              Find the exact camera, recorder, biometric device or network component — with clear
              pricing, model-specific documents, and secure checkout.
            </p>

            {/* Search bar */}
            <div className="hero-search-bar mt-8">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
              </svg>
              <Link href="/products" className="min-w-0 flex-1 text-[var(--text-muted)] no-underline">
                Search by exact model, brand or category…
              </Link>
              <kbd className="hidden sm:inline-flex font-mono text-xs text-[var(--text-muted)] border border-[var(--border)] rounded-[var(--radius-stage)] px-2 py-1">/</kbd>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/products" className="button-primary">
                Shop all products <ArrowRight size={16} />
              </Link>
              <Link href="/compare" className="button-secondary">
                Compare models <Scale size={16} />
              </Link>
            </div>

            <p className="mt-5 text-sm text-[var(--text-muted)]">
              GST-inclusive pricing · Exact-model documents · Secure Razorpay checkout
            </p>
          </div>

          {/* Right: Product composition — neutral bg, max 3 products */}
          <div className="relative mt-10 hidden lg:block lg:mt-0 lg:w-[48%]">
            <div
              className="relative overflow-hidden rounded-[var(--radius-container)] border border-[var(--border)] bg-[var(--surface-subtle)]"
              style={{ aspectRatio: "4/3" }}
              aria-label="CCTV dome camera, bullet camera and NVR system"
            >
              <div className="grid grid-cols-3 gap-4 p-8 h-full">
                {/* Dome camera */}
                {domeProduct && (
                  <div className="relative overflow-hidden rounded-[var(--radius-card)] bg-[var(--surface)] border border-[var(--border)]">
                    <Image
                      src={domeProduct.images[0]}
                      alt={`${domeProduct.brand} ${domeProduct.model}`}
                      fill
                      sizes="200px"
                      className="object-contain p-6"
                    />
                  </div>
                )}
                {/* Bullet camera */}
                {bulletProduct && (
                  <div className="relative overflow-hidden rounded-[var(--radius-card)] bg-[var(--surface)] border border-[var(--border)]">
                    <Image
                      src={bulletProduct.images[0]}
                      alt={`${bulletProduct.brand} ${bulletProduct.model}`}
                      fill
                      sizes="200px"
                      className="object-contain p-6"
                    />
                  </div>
                )}
                {/* NVR system */}
                {nvrProduct && (
                  <div className="relative overflow-hidden rounded-[var(--radius-card)] bg-[var(--surface)] border border-[var(--border)]">
                    <Image
                      src={nvrProduct.images[0]}
                      alt={`${nvrProduct.brand} ${nvrProduct.model}`}
                      fill
                      sizes="200px"
                      className="object-contain p-6"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          SECTION 2 — FOUR PRIMARY CATEGORIES
          Equal cards, same width/height, neutral bg, one product image.
          ═══════════════════════════════════════════════════════ */}
      <section className="section-space" style={{ background: "var(--surface)" }}>
        <div className="container-standard">
          <div className="mb-10 max-w-2xl">
            <p className="eyebrow">Categories</p>
            <h2 className="section-title mt-3">Browse by hardware type.</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {primaryCategories.map((cat) => {
              const representative = catalogue.find(cat.filterFn);
              return (
                <Link
                  key={cat.slug}
                  href={cat.href}
                  className="category-card group flex flex-col p-5 sm:p-6"
                >
                  {/* Product image — neutral bg */}
                  {representative && (
                    <div className="relative aspect-square mb-4 overflow-hidden rounded-[var(--radius-card)] bg-[var(--surface-subtle)]">
                      <Image
                        src={representative.images[0]}
                        alt={`${representative.brand} ${representative.model}`}
                        fill
                        sizes="(max-width: 640px) 50vw, 25vw"
                        className="object-contain p-4"
                      />
                    </div>
                  )}
                  <h3 className="font-display text-xl font-semibold">{cat.name}</h3>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">{cat.description}</p>
                  <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent)]">
                    Shop category
                    <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          SECTION 3 — FEATURED EXACT MODELS
          ═══════════════════════════════════════════════════════ */}
      <section className="section-space">
        <div className="container-standard">
          <div className="flex flex-wrap items-end justify-between gap-5 mb-10">
            <div className="max-w-xl">
              <p className="eyebrow">Featured exact models</p>
              <h2 className="section-title mt-3">In-stock hardware, priced clearly.</h2>
              <p className="mt-4 text-base text-[var(--text-secondary)] leading-7">
                GST-inclusive pricing with model documentation.
              </p>
            </div>
            <Link href="/products" className="button-secondary">
              View all products <ArrowRight size={16} />
            </Link>
          </div>
          <div className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(220px,1fr))]">
            {featuredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          SECTION 4 — COMPARE OR GET ASSISTANCE
          Compact dark-charcoal section.
          ═══════════════════════════════════════════════════════ */}
      <section style={{ background: "var(--dark)" }}>
        <div className="container-standard py-16 sm:py-20 lg:py-24">
          <div className="grid items-center gap-12 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <p className="eyebrow !text-[var(--dark-muted)]">Choosing between models?</p>
              <h2 className="section-title mt-3 text-[var(--dark-text)]">
                Compare the specifications that matter.
              </h2>
              <p className="mt-5 max-w-xl text-lg leading-8 text-[var(--dark-muted)]">
                Compare resolution, night vision, audio, PoE, weather resistance and warranty side
                by side. Or reach out for product-specific help.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link href="/compare" className="button-primary">
                  Compare products <Scale size={16} />
                </Link>
                <Link href="/contact" className="button-secondary !border-white/20 !bg-transparent !text-[var(--dark-text)] hover:!bg-white/10">
                  Get product help <MessageCircle size={16} />
                </Link>
              </div>
            </div>
            {/* Comparison preview: max 3 products */}
            {compareProducts.length > 0 && (
              <div className="grid grid-cols-3 gap-3">
                {compareProducts.map((product) => {
                  const eligible = getPurchaseEligibility(product, { maxAgeDays: getPriceMaxAgeDays() }).eligible;
                  return (
                    <Link
                      key={product.id}
                      href={`/products/${product.slug}`}
                      className="group rounded-[var(--radius-card)] border border-white/10 bg-[var(--dark-elevated)] p-3 transition-transform duration-200 hover:translate-y-[-2px] hover:border-white/20"
                    >
                      <div className="relative aspect-square overflow-hidden rounded-[var(--radius-stage)] bg-[var(--surface-subtle)]">
                        <Image
                          src={product.images[0]}
                          alt={`${product.brand} ${product.model}`}
                          fill
                          sizes="(max-width: 768px) 30vw, 220px"
                          className="object-contain p-3 sm:p-4"
                        />
                      </div>
                      <p className="mt-2 font-mono text-xs font-medium text-[var(--dark-muted)]">
                        {product.model}
                      </p>
                      <p className="mt-0.5 truncate text-xs font-semibold text-[var(--dark-text)]">
                        {product.brand}
                      </p>
                      {eligible && (
                        <p className="mt-1 text-sm font-bold text-[var(--dark-text)]">
                          {formatPrice(product.sellingPriceInclGstPaise)}
                        </p>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          SECTION 5 — TRUST AND BUYING INFORMATION
          Compact row: small neutral icons, no oversized boxes.
          ═══════════════════════════════════════════════════════ */}
      <section className="section-space" style={{ background: "var(--surface)" }}>
        <div className="container-standard">
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-5">
            {[
              [IndianRupee, "GST-inclusive pricing", "Every displayed price includes GST with clear invoice breakdown."],
              [FileText, "Exact-model documents", "Datasheets, manuals and installation guides matched to each product."],
              [BadgeCheck, "OEM warranty support", "Manufacturer warranty supported where applicable, with documentation."],
              [CreditCard, "Secure Razorpay checkout", "Protected payment processing with multiple payment methods."],
              [Truck, `${siteConfig.serviceArea} assistance`, "Product help and delivery coordination for Delhi NCR."],
            ].map(([Icon, title, desc]) => {
              const I = Icon as typeof BadgeCheck;
              return (
                <div key={title as string} className="surface-card p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-btn)] bg-[var(--surface-subtle)]">
                      <I size={18} className="text-[var(--text-secondary)]" />
                    </div>
                    <p className="font-semibold text-sm">{title as string}</p>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{desc as string}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}
