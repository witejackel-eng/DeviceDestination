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
        className="mb-6 flex flex-wrap gap-2 text-sm text-[var(--text-muted)]"
      >
        <Link href="/" className="hover:text-[var(--text-primary)] transition-colors">Home</Link>
        <span>/</span>
        <Link href="/products" className="hover:text-[var(--text-primary)] transition-colors">Products</Link>
        <span>/</span>
        <span aria-current="page" className="text-[var(--text-primary)]">{product.model}</span>
      </nav>

      {/* ── Product hero: gallery + info ─────────────────────── */}
      <div className="grid gap-10 lg:grid-cols-[1.08fr_0.92fr] lg:gap-16">
        {/* Gallery — neutral bg */}
        <div className="relative aspect-square overflow-hidden rounded-[var(--radius-container)] border border-[var(--border)] bg-[var(--surface-subtle)]">
          <ProductGallery images={product.images} alt={`${product.brand} ${product.model}`} />
        </div>
        <div className="lg:pt-2">
          {/* Brand/category */}
          <p className="eyebrow">
            {product.brand} · {product.category}
          </p>
          {/* Title */}
          <h1 className="mt-3 font-display text-[clamp(2rem,4vw,3.5rem)] font-bold leading-tight tracking-[-0.02em]">
            {product.title}
          </h1>
          {/* Model (Geist Mono) */}
          <p className="mt-3 font-mono text-sm font-medium text-[var(--text-secondary)]">
            {product.model}
          </p>
          {/* Description */}
          <p className="mt-5 text-base leading-7 text-[var(--text-secondary)]">{product.shortDescription}</p>

          {/* Price block */}
          <div className="mt-6 border-y border-[var(--border)] py-5">
            {compareAt && product.compareAtLabel && (
              <p className="text-xs text-[var(--text-muted)]">
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
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              {eligibility.eligible
                ? "Inclusive of all taxes · GST invoice provided"
                : "Current price and availability must be confirmed before checkout"}
            </p>
            {product.priceVerifiedAt && eligibility.eligible && (
              <p className="mt-1.5 text-[11px] text-[var(--text-muted)]">
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
          <div className="mt-6 grid gap-2.5 rounded-[var(--radius-container)] border border-[var(--border)] p-4">
            <p className="flex items-center gap-2.5 text-sm">
              <ShieldCheck size={16} style={{ color: "var(--success)" }} />
              <span className="font-semibold">{product.warrantySummary}</span>
            </p>
            <p className="flex items-center gap-2.5 text-sm text-[var(--text-secondary)]">
              <FileCheck2 size={16} className="text-[var(--text-muted)]" />
              GST invoice with exact model
            </p>
            <p className="flex items-center gap-2.5 text-sm text-[var(--text-secondary)]">
              <Truck size={16} className="text-[var(--text-muted)]" />
              Delivery timing confirmed before dispatch
            </p>
          </div>
        </div>
      </div>

      {/* ── Product information ─────────────────────────────── */}
      <section className="section-space !pb-10">
        <div className="max-w-2xl mb-8">
          <p className="eyebrow">Product information</p>
          <h2 className="section-title mt-3">Details you can scan.</h2>
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
                className="group rounded-[var(--radius-container)] border border-[var(--border)] bg-[var(--surface)] p-5"
                open={title === "Overview"}
              >
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between font-display text-lg font-bold">
                  <span>{title}</span>
                  <span className="text-xl transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="pb-2 pt-3 leading-7 text-[var(--text-secondary)] text-sm">{body}</p>
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
            <h2 className="section-title mt-3">Exact model.</h2>
          </div>
          <dl className="overflow-hidden rounded-[var(--radius-container)] border border-[var(--border)]">
            {Object.entries(product.specs).map(([label, value], index) => (
              <div
                key={label}
                className={`grid border-b border-[var(--border)] last:border-b-0 sm:grid-cols-[0.38fr_0.62fr] ${index % 2 === 0 ? "" : "bg-[var(--surface-subtle)]"}`}
              >
                <dt className="px-5 py-3.5 text-sm font-semibold">{label}</dt>
                <dd className="px-5 py-3.5 text-sm leading-6 text-[var(--text-secondary)]">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ── Downloads — neutral list ────────────────────────── */}
      {product.documents.length > 0 && (
        <section className="section-space !pt-10">
          <div className="container-standard">
            <p className="eyebrow">Exact-model downloads</p>
            <h2 className="section-title mt-3">Keep the technical facts close.</h2>
            <div className="mt-6 grid gap-2">
              {product.documents.map((document) => (
                <a
                  key={document.url}
                  href={document.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-3 rounded-[var(--radius-btn)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm font-semibold transition-colors hover:bg-[var(--surface-hover)]"
                >
                  <Download size={15} className="text-[var(--text-muted)]" />
                  <span className="text-[var(--text-secondary)]">{document.type}</span>
                  <span className="font-mono text-xs text-[var(--text-muted)]">{document.model}</span>
                  <span className="font-semibold">{document.title}</span>
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Related products ────────────────────────────────── */}
      {related.length > 0 && (
        <section className="section-space !pt-10">
          <div className="container-standard">
            <p className="eyebrow">Related exact models</p>
            <h2 className="section-title mt-3">Worth comparing.</h2>
            <div className="mt-8 grid gap-4 grid-cols-[repeat(auto-fill,minmax(220px,1fr))]">
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
