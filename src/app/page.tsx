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
import { siteConfig } from "@/config/site";
import { getFeaturedProducts } from "@/lib/featured-products";
import { resolveHeroProducts, deriveAnnotations } from "@/lib/home/hero-products";
import { CinematicCommerceHero } from "@/components/home/cinematic-commerce-hero";

export const metadata: Metadata = publicPageMetadata({
  title: "Shop CCTV, biometric and networking hardware",
  description:
    "Find exact-model CCTV cameras, NVRs, biometric devices and PoE switches with GST-inclusive prices and model-specific documents.",
  path: "/",
});

/* Four primary categories for section 2 — with curated representative products and dynamic counts */
const primaryCategories = [
  {
    slug: "dome-cameras",
    name: "CCTV Cameras",
    description: "Dome, bullet and colour models for indoor and outdoor surveillance.",
    href: "/products?q=camera",
    representativeModel: "CP-UNC-DA41L3C-D-Q",
    filterFn: (p: (typeof catalogue)[number]) => p.categorySlug.includes("camera"),
  },
  {
    slug: "nvr-systems",
    name: "NVR & Recording",
    description: "Network video recorders and storage for multi-camera setups.",
    href: "/categories/nvr-systems",
    representativeModel: "CP-UNR-108F1",
    filterFn: (p: (typeof catalogue)[number]) => p.categorySlug.includes("nvr"),
  },
  {
    slug: "biometric-devices",
    name: "Biometric Devices",
    description: "Fingerprint, face recognition and access control terminals.",
    href: "/categories/biometric-devices",
    representativeModel: "X990",
    fallbackModel: "F22+ID+WIFI",
    filterFn: (p: (typeof catalogue)[number]) => p.categorySlug.includes("biometric"),
  },
  {
    slug: "poe-switches",
    name: "PoE & Networking",
    description: "Power-over-Ethernet switches and network infrastructure.",
    href: "/categories/poe-switches",
    representativeModel: "GS108PP",
    filterFn: (p: (typeof catalogue)[number]) => p.categorySlug.includes("poe") || p.categorySlug.includes("switch"),
  },
];

/* Comparison section: specific camera products for meaningful spec comparison */
const compareProductModels = ["CP-UNC-DA41L3C-D-Q", "CP-UNC-TA41L3C-Q", "CP-UNC-DA41L3C-LQ"];

/* Comparison spec rows for mini table */
const compareSpecRows = [
  { label: "Model", key: "model" },
  { label: "Resolution", key: "resolution" },
  { label: "Form", key: "form" },
  { label: "Night vision", key: "nightVision" },
  { label: "PoE", key: "poe" },
  { label: "Weather rating", key: "weather" },
  { label: "Audio", key: "audio" },
  { label: "Warranty", key: "warranty" },
];

function getCompareSpecValue(product: (typeof catalogue)[number], key: string): string {
  const specs = product.specs;
  switch (key) {
    case "model":
      return product.model;
    case "resolution": {
      const sensor = specs["Image Sensor"] ?? specs["Max resolution"] ?? "";
      const resMatch = sensor.match(/(\d)\s*MP/i) ?? specs["Max Resolution"]?.match(/(\d)\s*MP/i);
      if (resMatch) return `${resMatch[1]} MP`;
      return specs["Max resolution"] ?? specs["Max Resolution"] ?? "—";
    }
    case "form":
      if (product.categorySlug.includes("dome")) return "Dome";
      if (product.categorySlug.includes("bullet")) return "Bullet";
      return product.category;
    case "nightVision": {
      const ir = specs["IR Range"] ?? specs["IR range"] ?? "";
      if (ir) return ir;
      const night = specs["Night Vision"] ?? specs["Night illumination"] ?? "";
      if (night) return night;
      return "—";
    }
    case "poe":
      if (specs["Power"]?.includes("PoE")) return "Yes";
      return "—";
    case "weather":
      return specs["IP Rating"] ?? "—";
    case "audio":
      if (specs["Audio"]?.includes("Microphone")) return "Built-in mic";
      if (specs["Audio"]) return specs["Audio"];
      return "—";
    case "warranty":
      return specs["Warranty"] ?? "—";
    default:
      return "—";
  }
}

export default function Home() {
  /* Hero products: resolved with fallbacks from real catalogue */
  const heroProducts = resolveHeroProducts();
  const annotations = deriveAnnotations(heroProducts);

  /* Featured products: curated selection representing multiple categories */
  const featuredProducts = getFeaturedProducts(8);

  /* Compare section: 3 specific camera products */
  const compareProducts = compareProductModels
    .map((model) => catalogue.find((p) => p.model === model))
    .filter((p): p is (typeof catalogue)[number] => p !== undefined && p.stockStatus === "in_stock")
    .slice(0, 3);

  return (
    <>
      {/* ═══════════════════════════════════════════════════════
          SECTION 1 — CINEMATIC HERO
          Scroll-driven product narrative with real catalogue products.
          ═══════════════════════════════════════════════════════ */}
      <CinematicCommerceHero heroProducts={heroProducts} annotations={annotations} />

      {/* ═══════════════════════════════════════════════════════
          SECTION 2 — FOUR PRIMARY CATEGORIES
          Curated representatives, dynamic product counts, same-height cards.
          ═══════════════════════════════════════════════════════ */}
      <section className="section-space" style={{ background: "var(--surface)" }}>
        <div className="container-standard">
          <div className="mb-10 max-w-2xl">
            <p className="eyebrow">Categories</p>
            <h2 className="section-title mt-3">Browse by hardware type.</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {primaryCategories.map((cat) => {
              /* Find curated representative by model, with fallback */
              let representative = catalogue.find((p) => p.model === cat.representativeModel);
              if (!representative && "fallbackModel" in cat) {
                representative = catalogue.find((p) => p.model === (cat as { fallbackModel: string }).fallbackModel);
              }
              if (!representative) representative = catalogue.find(cat.filterFn);

              /* Dynamic product count */
              const productCount = catalogue.filter(cat.filterFn).length;

              return (
                <Link
                  key={cat.slug}
                  href={cat.href}
                  className="category-card group flex flex-col p-5 sm:p-6"
                >
                  {/* Product image — neutral bg, consistent ratio */}
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
                  <p className="mt-1 text-sm font-medium text-[var(--accent)]">{productCount} exact models</p>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">{cat.description}</p>
                  <span className="mt-auto pt-4 inline-flex items-center gap-2 text-sm font-semibold text-[var(--accent)]">
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
          Curated selection representing multiple categories. 4-column max grid.
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
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {featuredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════
          SECTION 4 — COMPARE OR GET ASSISTANCE
          Compact dark-charcoal section with mini comparison table.
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
            {/* Mini comparison preview: compact spec table */}
            {compareProducts.length > 0 && (
              <div className="overflow-x-auto no-scrollbar rounded-[var(--radius-container)] border border-white/10 bg-[var(--dark-elevated)]">
                {/* Product header row with images */}
                <div className="grid border-b border-white/10" style={{ gridTemplateColumns: `120px repeat(${compareProducts.length}, minmax(140px, 1fr))` }}>
                  <div className="p-3"></div>
                  {compareProducts.map((product) => (
                    <div key={product.id} className="p-3 text-center">
                      <div className="relative aspect-square mx-auto max-w-[80px] overflow-hidden rounded-[var(--radius-stage)] bg-[var(--surface-subtle)]">
                        <Image
                          src={product.images[0]}
                          alt={product.model}
                          fill
                          sizes="80px"
                          className="object-contain p-2"
                        />
                      </div>
                      <p className="mt-2 font-mono text-xs font-medium text-[var(--dark-text)]">
                        {product.model}
                      </p>
                    </div>
                  ))}
                </div>
                {/* Spec rows */}
                {compareSpecRows.map((row) => {
                  const values = compareProducts.map((p) => getCompareSpecValue(p, row.key));
                  /* Skip rows where all values are "—" */
                  if (values.every((v) => v === "—")) return null;

                  return (
                    <div
                      key={row.key}
                      className="grid border-b border-white/5 last:border-b-0"
                      style={{ gridTemplateColumns: `120px repeat(${compareProducts.length}, minmax(140px, 1fr))` }}
                    >
                      <div className="p-3 text-xs font-semibold text-[var(--dark-muted)]">{row.label}</div>
                      {values.map((value, i) => (
                        <div key={i} className={`p-3 text-sm ${value !== values[0] && values.filter(v => v !== "—").length > 1 ? "font-semibold text-[var(--dark-text)]" : "text-[var(--dark-muted)]"}`}>
                          {value}
                        </div>
                      ))}
                    </div>
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
