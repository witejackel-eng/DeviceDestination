import type { Metadata } from "next";
import { siteConfig, isCanonicalDomainProductionReady } from "@/config/site";

/**
 * Metadata for a public page. Includes canonical URL, OpenGraph, and Twitter
 * card. Uses absolute URLs based on the configured canonical site URL.
 *
 * If the canonical domain is not production-ready (e.g. a Vercel preview
 * URL or localhost), canonical tags are still emitted but structured data
 * is suppressed to avoid indexing non-canonical origins.
 */
export function publicPageMetadata(input: {
  title: string;
  description: string;
  path: string;
  noIndex?: boolean;
  image?: string;
}): Metadata {
  const canonicalUrl = new URL(input.path, siteConfig.url).toString();
  const ogImage = input.image ?? `${siteConfig.url}/og-default.png`;

  return {
    title: input.title,
    description: input.description,
    alternates: { canonical: canonicalUrl },
    robots: input.noIndex ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: {
      title: input.title,
      description: input.description,
      url: canonicalUrl,
      siteName: siteConfig.name,
      locale: "en_IN",
      type: "website",
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: input.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: input.title,
      description: input.description,
      images: [ogImage],
    },
  };
}

/**
 * Metadata for a private page (admin, account, checkout, order, cart).
 * Returns `noindex, nofollow` so search engines never index these pages.
 * The page is still protected by authentication — robots is not a security
 * boundary, but it prevents accidental indexing.
 */
export function privatePageMetadata(input: {
  title: string;
  path?: string;
}): Metadata {
  return {
    title: input.title,
    robots: { index: false, follow: false },
    // No canonical URL for private pages — they should not be indexed.
    alternates: input.path ? { canonical: new URL(input.path, siteConfig.url).toString() } : undefined,
  };
}

/**
 * Product structured data (JSON-LD). Uses only verified data from the
 * product record. Does NOT include fake reviews, ratings, GTIN, or stock.
 */
export function productStructuredData(input: {
  slug: string;
  title: string;
  model: string;
  description: string;
  brandName: string;
  categoryName: string;
  sellingPriceInclGstPaise: number | null;
  mrpInclGstPaise: number | null;
  stockStatus: string;
  imageUrls: string[];
  verifiedAt: Date;
}): Record<string, unknown> {
  const url = `${siteConfig.url}/products/${input.slug}`;
  const offers =
    input.sellingPriceInclGstPaise !== null
      ? {
          "@type": "Offer",
          url,
          price: (input.sellingPriceInclGstPaise / 100).toFixed(2),
          priceCurrency: "INR",
          priceValidUntil: new Date(input.verifiedAt.getTime() + 30 * 86_400_000)
            .toISOString()
            .split("T")[0],
          availability:
            input.stockStatus === "in_stock"
              ? "https://schema.org/InStock"
              : input.stockStatus === "limited"
                ? "https://schema.org/LimitedAvailability"
                : input.stockStatus === "lead_time"
                  ? "https://schema.org/PreOrder"
                  : "https://schema.org/OutOfStock",
          seller: {
            "@type": "Organization",
            name: siteConfig.legalName,
          },
        }
      : undefined;

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: input.title,
    model: input.model,
    sku: input.model,
    mpn: input.model,
    description: input.description,
    brand: {
      "@type": "Brand",
      name: input.brandName,
    },
    category: input.categoryName,
    image: input.imageUrls.length > 0 ? input.imageUrls : undefined,
    offers,
    // Do NOT include aggregateRating or review — we don't have real reviews.
    // Do NOT include gtin — we don't have real GTIN values.
  };
}

/**
 * Organization structured data (JSON-LD). Uses only verified data.
 */
export function organizationStructuredData(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteConfig.legalName,
    url: siteConfig.url,
    logo: `${siteConfig.url}/icon.svg`,
    description: siteConfig.description,
    address: {
      "@type": "PostalAddress",
      streetAddress: siteConfig.address.street,
      addressLocality: siteConfig.address.city,
      addressRegion: siteConfig.address.region,
      postalCode: siteConfig.address.postalCode,
      addressCountry: siteConfig.address.country,
    },
    contactPoint: {
      "@type": "ContactPoint",
      telephone: siteConfig.contact.phoneE164,
      email: siteConfig.contact.email,
      contactType: "customer service",
      areaServed: "IN",
      availableLanguage: ["en", "hi"],
    },
    // Only include GSTIN if it's verified and present.
    ...(siteConfig.gstin
      ? { identifier: { "@type": "PropertyValue", name: "GSTIN", value: siteConfig.gstin } }
      : {}),
    // Do NOT include sameAs social profiles unless they're verified.
  };
}

/**
 * Whether structured data should be emitted. Only true when the canonical
 * domain is production-ready (not a Vercel preview or localhost).
 */
export function shouldEmitStructuredData(): boolean {
  return isCanonicalDomainProductionReady();
}
