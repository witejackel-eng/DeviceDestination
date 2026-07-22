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
    .slice(0, 3);
  const whatsapp = `https://wa.me/${siteConfig.contact.whatsapp}?text=${encodeURIComponent(`Hello, I need help with ${product.model} (${product.title}).`)}`;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.devicedestination.com";
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
    <div className="container-standard py-8 sm:py-12">
      <nav
        aria-label="Breadcrumb"
        className="mb-8 flex flex-wrap gap-2 text-sm text-[var(--muted)]"
      >
        <Link href="/">Home</Link>
        <span>/</span>
        <Link href="/products">Products</Link>
        <span>/</span>
        <span aria-current="page">{product.model}</span>
      </nav>
      <div className="grid gap-10 lg:grid-cols-[1.04fr_0.96fr] lg:gap-16">
        <ProductGallery images={product.images} alt={`${product.brand} ${product.model}`} />
        <div className="lg:pt-3">
          <p className="eyebrow">
            {product.brand} · {product.category}
          </p>
          <h1 className="mt-4 font-display text-[clamp(2.8rem,5vw,5.4rem)] font-semibold leading-[0.96] tracking-[-0.06em]">
            {product.title}
          </h1>
          <p className="mt-4 text-sm font-extrabold uppercase tracking-[0.1em] text-[var(--tangerine-dark)]">
            {product.model}
          </p>
          <p className="mt-6 text-lg leading-8 text-[var(--muted)]">{product.shortDescription}</p>
          <div className="mt-7 border-y border-[var(--line)] py-6">
            {compareAt && product.compareAtLabel && (
              <p className="text-sm text-[var(--muted)]">
                <span className="price-old">
                  {product.compareAtLabel} {formatPrice(compareAt)}
                </span>
                {discount ? ` · ${discount}% off` : ""}
              </p>
            )}
            <p className="font-display text-4xl font-bold">
              {eligibility.eligible
                ? formatPrice(product.sellingPriceInclGstPaise)
                : "Request latest price"}
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {eligibility.eligible
                ? "Inclusive of all taxes · GST invoice provided"
                : "Current price and availability must be confirmed before checkout"}
            </p>
            {product.priceVerifiedAt && eligibility.eligible && (
              <p className="mt-2 text-xs text-[var(--muted)]">
                Price verified{" "}
                {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(
                  new Date(product.priceVerifiedAt),
                )}
              </p>
            )}
          </div>
          <div className="mt-7">
            <ProductActions productId={product.id} />
          </div>
          <div className="mt-3">
            <CompareToggle productId={product.id} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Link href="/quote" className="button-secondary text-center">
              <Wrench size={17} /> Installation help
            </Link>
            <a
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="button-secondary text-center"
            >
              <MessageCircle size={17} /> WhatsApp
            </a>
          </div>
          <DeliveryChecker />
          <div className="mt-7 grid gap-3 rounded-2xl bg-[var(--canvas-alt)] p-5 text-sm">
            <p className="flex items-center gap-3">
              <ShieldCheck size={18} className="text-[var(--success)]" /> {product.warrantySummary}
            </p>
            <p className="flex items-center gap-3">
              <FileCheck2 size={18} /> GST invoice with exact model
            </p>
            <p className="flex items-center gap-3">
              <Truck size={18} /> Delivery timing confirmed before dispatch
            </p>
          </div>
        </div>
      </div>

      <section className="section-space !pb-8">
        <div className="grid gap-10 lg:grid-cols-[0.7fr_1.3fr]">
          <div>
            <p className="eyebrow">Product information</p>
            <h2 className="display-section mt-4">Details you can scan.</h2>
            <a
              href={product.officialSourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="button-secondary mt-7"
            >
              Official product page <ExternalLink size={16} />
            </a>
          </div>
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
                className="group rounded-2xl border border-[var(--line)] bg-white p-5"
                open={title === "Overview"}
              >
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between font-display text-xl font-semibold">
                  <span>{title}</span>
                  <span className="text-2xl transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="pb-2 pt-3 leading-7 text-[var(--muted)]">{body}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="section-space !pt-14">
        <div className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr]">
          <div>
            <p className="eyebrow">Technical specifications</p>
            <h2 className="display-section mt-4">
              Exact model.
              <br />
              Clear facts.
            </h2>
          </div>
          <dl className="overflow-hidden rounded-[20px] border border-[var(--line)] bg-white">
            {Object.entries(product.specs).map(([label, value]) => (
              <div
                key={label}
                className="grid border-b border-[var(--line)] last:border-b-0 sm:grid-cols-[0.42fr_0.58fr]"
              >
                <dt className="bg-[var(--canvas-alt)] px-5 py-4 text-sm font-bold">{label}</dt>
                <dd className="px-5 py-4 text-sm leading-6 text-[var(--muted)]">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {product.documents.length > 0 && (
        <section className="section-space !pt-14">
          <div className="rounded-[26px] bg-[var(--ink)] p-7 text-white sm:p-12">
            <p className="eyebrow !text-white/55">Exact-model downloads</p>
            <h2 className="mt-4 font-display text-5xl font-semibold">
              Keep the technical facts close.
            </h2>
            <div className="mt-8 flex flex-wrap gap-3">
              {product.documents.map((document) => (
                <a
                  key={document.url}
                  href={document.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="button-secondary !border-white/20 !bg-white/10 !text-white"
                >
                  <Download size={17} /> {document.title}
                </a>
              ))}
            </div>
          </div>
        </section>
      )}

      {related.length > 0 && (
        <section className="section-space !pt-12">
          <p className="eyebrow">Related exact models</p>
          <h2 className="display-section mt-4">Worth comparing.</h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      )}
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
