import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  Download,
  ExternalLink,
  FileCheck2,
  MessageCircle,
  ShieldCheck,
  Truck,
  Wrench,
} from "lucide-react";
import { catalogue, getProduct } from "@/data/catalog";
import { formatPrice, calculateDiscountPercent, getPurchaseEligibility } from "@/lib/products";
import { getPriceMaxAgeDays } from "@/config/site";
import { ProductGallery } from "@/components/product-gallery";
import { ProductActions } from "@/components/product-actions";
import { DeliveryChecker } from "@/components/delivery-checker";
import { ProductCard } from "@/components/product-card";
import { CompareToggle } from "@/components/compare-toggle";
import { siteConfig } from "@/config/site";
import { MobileProductBar } from "@/components/mobile-product-bar";
import { RecentlyViewed, TrackRecentlyViewed } from "@/components/recently-viewed";

type Params = Promise<{ slug: string }>;

export function generateStaticParams() {
  return catalogue.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product) return { title: "Product not found" };
  return {
    title: `${product.model} — ${product.title}`,
    description: product.shortDescription,
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: {
      title: `${product.model} | DeviceDestination`,
      description: product.shortDescription,
      images: [{ url: product.images[0], alt: `${product.brand} ${product.model}` }],
    },
  };
}

/** Category-based colour for product image backgrounds */
function categoryGalleryBg(categorySlug: string): string {
  if (categorySlug.includes("dome")) return "var(--powder-blue-soft)";
  if (categorySlug.includes("bullet")) return "var(--butter-soft)";
  if (categorySlug.includes("color")) return categorySlug.includes("bullet")
    ? "var(--peach)"
    : "var(--coral-soft)";
  if (categorySlug.includes("nvr")) return "var(--lilac-soft)";
  if (categorySlug.includes("biometric")) return "var(--mint-soft)";
  if (categorySlug.includes("poe") || categorySlug.includes("switch")) return "var(--technical-grey)";
  return "var(--canvas)";
}

export default async function ProductPage({ params }: { params: Params }) {
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product) notFound();
  if (slug !== product.slug) redirect(`/products/${product.slug}`);
  const compareAt = product.mrpInclGstPaise ?? product.compareAtPriceInclGstPaise;
  const discount =
    product.sellingPriceInclGstPaise === null
      ? null
      : calculateDiscountPercent(product.sellingPriceInclGstPaise, compareAt);
  const eligibility = getPurchaseEligibility(product, { maxAgeDays: getPriceMaxAgeDays() });
  const related = catalogue
    .filter((item) => item.categorySlug === product.categorySlug && item.id !== product.id)
    .slice(0, 4);
  const whatsapp = `https://wa.me/${siteConfig.contact.whatsapp}?text=${encodeURIComponent(`Hello, I need help with ${product.model} (${product.title}).`)}`;
  const siteUrl = siteConfig.url;
  const galleryBg = categoryGalleryBg(product.categorySlug);

  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    sku: product.model,
    brand: { "@type": "Brand", name: product.brand },
    image: product.images.map((url) => new URL(url, siteUrl).toString()),
    description: product.shortDescription,
    offers:
      !eligibility.eligible || product.sellingPriceInclGstPaise === null
        ? undefined
        : {
            "@type": "Offer",
            priceCurrency: "INR",
            price: (product.sellingPriceInclGstPaise / 100).toFixed(2),
            availability:
              product.stockStatus === "in_stock"
                ? "https://schema.org/InStock"
                : "https://schema.org/LimitedAvailability",
            url: `${siteUrl}/products/${product.slug}`,
          },
  };
  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteUrl },
      { "@type": "ListItem", position: 2, name: "Products", item: `${siteUrl}/products` },
      {
        "@type": "ListItem",
        position: 3,
        name: product.model,
        item: `${siteUrl}/products/${product.slug}`,
      },
    ],
  };

  return (
    <div className="container-standard pb-28 pt-6 sm:pt-10">
      <TrackRecentlyViewed productId={product.id} />
      <nav
        aria-label="Breadcrumb"
        className="mb-6 flex flex-wrap gap-2 text-sm text-[var(--muted)]"
      >
        <Link href="/" className="hover:text-[var(--ink)] transition-colors">Home</Link>
        <span>/</span>
        <Link href="/products" className="hover:text-[var(--ink)] transition-colors">Products</Link>
        <span>/</span>
        <span aria-current="page" className="text-[var(--ink)]">{product.model}</span>
      </nav>

      {/* ── Product hero: gallery + info ─────────────────────── */}
      <div className="grid gap-10 lg:grid-cols-[1.04fr_0.96fr] lg:gap-16">
        <div className="relative aspect-square overflow-hidden rounded-[26px] border border-[var(--line)]" style={{ background: galleryBg }}>
          <ProductGallery images={product.images} alt={`${product.brand} ${product.model}`} />
        </div>
        <div className="lg:pt-2">
          <p className="eyebrow">
            {product.brand} · {product.category}
          </p>
          <h1 className="mt-3 font-display text-[clamp(2.5rem,5vw,5rem)] font-bold leading-[0.94] tracking-[-0.03em]">
            {product.title}
          </h1>
          <p className="mt-3 text-sm font-bold uppercase tracking-[0.1em]" style={{ color: "var(--tangerine-text)" }}>
            {product.model}
          </p>
          <p className="mt-5 text-base leading-7 text-[var(--ink-soft)]">{product.shortDescription}</p>

          {/* Price block */}
          <div className="mt-6 border-y border-[var(--line)] py-5">
            {compareAt && product.compareAtLabel && (
              <p className="text-xs text-[var(--muted)]">
                <span className="price-old">
                  {product.compareAtLabel} {formatPrice(compareAt)}
                </span>
                {discount ? ` · ${discount}% off` : ""}
              </p>
            )}
            <p className="font-display text-3xl font-bold mt-1">
              {eligibility.eligible
                ? formatPrice(product.sellingPriceInclGstPaise)
                : "Request latest price"}
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {eligibility.eligible
                ? "Inclusive of all taxes · GST invoice provided"
                : "Current price and availability must be confirmed before checkout"}
            </p>
            {product.priceVerifiedAt && eligibility.eligible && (
              <p className="mt-1.5 text-[11px] text-[var(--muted)]">
                Price verified{" "}
                {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(
                  new Date(product.priceVerifiedAt),
                )}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="mt-6">
            <ProductActions productId={product.id} />
          </div>
          <div className="mt-3">
            <CompareToggle productId={product.id} />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <Link href="/quote" className="button-secondary text-center text-sm">
              <Wrench size={15} /> Installation help
            </Link>
            <a
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="button-secondary text-center text-sm"
            >
              <MessageCircle size={15} /> WhatsApp
            </a>
          </div>
          <DeliveryChecker />

          {/* Trust badges */}
          <div className="mt-6 grid gap-2.5 rounded-2xl border border-[var(--line)] p-4">
            <p className="flex items-center gap-2.5 text-sm">
              <ShieldCheck size={16} style={{ color: "var(--success)" }} />
              <span className="font-semibold">{product.warrantySummary}</span>
            </p>
            <p className="flex items-center gap-2.5 text-sm text-[var(--ink-soft)]">
              <FileCheck2 size={16} className="text-[var(--muted)]" />
              GST invoice with exact model
            </p>
            <p className="flex items-center gap-2.5 text-sm text-[var(--ink-soft)]">
              <Truck size={16} className="text-[var(--muted)]" />
              Delivery timing confirmed before dispatch
            </p>
          </div>
        </div>
      </div>

      {/* ── Product information ─────────────────────────────── */}
      <section className="section-space !pb-10">
        <div className="max-w-2xl mb-8">
          <p className="eyebrow">Product information</p>
          <h2 className="display-section mt-3">Details you can scan.</h2>
        </div>
        <div className="container-reading">
          <div className="grid gap-3">
            {[
              ["Overview", product.longDescription],
              ["Key highlights", product.highlights.join(" · ")],
              [
                "Installation requirements",
                "Confirm mounting location, power or PoE availability, cable route, network bandwidth and compatible recorder before installation.",
              ],
              ["Warranty", product.warrantySummary],
              [
                "Delivery and returns",
                "Inspect the exact model and packaging at delivery. Return eligibility follows the published refund policy and manufacturer conditions.",
              ],
            ].map(([title, body]) => (
              <details
                key={title}
                className="group rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5"
                open={title === "Overview"}
              >
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between font-display text-lg font-bold">
                  <span>{title}</span>
                  <span className="text-xl transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="pb-2 pt-3 leading-7 text-[var(--ink-soft)] text-sm">{body}</p>
              </details>
            ))}
          </div>
          <a
            href={product.officialSourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="button-secondary mt-6"
          >
            Official product page <ExternalLink size={15} />
          </a>
        </div>
      </section>

      {/* ── Specifications ──────────────────────────────────── */}
      <section className="section-space !pt-10" style={{ background: "var(--surface)" }}>
        <div className="container-standard">
          <div className="max-w-2xl mb-8">
            <p className="eyebrow">Technical specifications</p>
            <h2 className="display-section mt-3">
              Exact model.
            </h2>
          </div>
          <dl className="overflow-hidden rounded-[22px] border border-[var(--line)]">
            {Object.entries(product.specs).map(([label, value]) => (
              <div
                key={label}
                className="grid border-b border-[var(--line)] last:border-b-0 sm:grid-cols-[0.38fr_0.62fr]"
              >
                <dt className="px-5 py-3.5 text-sm font-bold bg-[var(--canvas)]">{label}</dt>
                <dd className="px-5 py-3.5 text-sm leading-6 text-[var(--ink-soft)] bg-[var(--surface)]">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ── Downloads ───────────────────────────────────────── */}
      {product.documents.length > 0 && (
        <section className="section-space !pt-10">
          <div className="container-standard">
            <div className="rounded-[24px] p-7 sm:p-10" style={{ background: "var(--ink)" }}>
              <p className="eyebrow !text-white/50">Exact-model downloads</p>
              <h2 className="mt-3 font-display text-4xl font-bold text-white sm:text-5xl">
                Keep the technical facts close.
              </h2>
              <div className="mt-6 flex flex-wrap gap-2.5">
                {product.documents.map((document) => (
                  <a
                    key={document.url}
                    href={document.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-white/20"
                  >
                    <Download size={15} /> {document.title}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Related products ────────────────────────────────── */}
      {related.length > 0 && (
        <section className="section-space !pt-10" style={{ background: "var(--canvas-warm)" }}>
          <div className="container-standard">
            <p className="eyebrow">Related exact models</p>
            <h2 className="display-section mt-3">Worth comparing.</h2>
            <div className="mt-8 grid gap-4 grid-cols-[repeat(auto-fit,minmax(220px,1fr))]">
              {related.map((item) => (
                <ProductCard key={item.id} product={item} />
              ))}
            </div>
          </div>
        </section>
      )}

      <RecentlyViewed excludeId={product.id} />
      <MobileProductBar productId={product.id} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }}
      />
    </div>
  );
}
