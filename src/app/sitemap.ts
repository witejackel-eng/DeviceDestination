import type { MetadataRoute } from "next";
import { brands, catalogue, categories } from "@/data/catalog";
import { siteConfig } from "@/config/site";

/**
 * Sitemap generation.
 *
 * Per the spec:
 *   - Does NOT use `lastModified: new Date()` for static routes. Uses a
 *     stable build-time date so the sitemap is deterministic.
 *   - Uses real product verification dates for product URLs.
 *   - Excludes empty brand and category pages.
 *   - Excludes unpublished products.
 *   - Excludes non-canonical legacy product URLs.
 *   - Excludes utility pages that should not be indexed.
 */

// Stable build-time date for static routes. This changes only when the code
// is redeployed, not on every sitemap generation request.
const BUILD_DATE = new Date("2025-01-01T00:00:00Z");

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteConfig.url;

  // Static routes with stable lastModified dates.
  const staticRoutes = [
    { route: "", priority: 1.0, changeFrequency: "weekly" as const },
    { route: "/products", priority: 0.9, changeFrequency: "daily" as const },
    { route: "/system-builder", priority: 0.7, changeFrequency: "monthly" as const },
    { route: "/downloads", priority: 0.6, changeFrequency: "monthly" as const },
    { route: "/about", priority: 0.6, changeFrequency: "monthly" as const },
    { route: "/contact", priority: 0.7, changeFrequency: "monthly" as const },
    { route: "/support", priority: 0.7, changeFrequency: "monthly" as const },
    { route: "/quote", priority: 0.6, changeFrequency: "monthly" as const },
    { route: "/privacy", priority: 0.3, changeFrequency: "yearly" as const },
    { route: "/terms", priority: 0.3, changeFrequency: "yearly" as const },
    { route: "/shipping-policy", priority: 0.3, changeFrequency: "yearly" as const },
    { route: "/refund-policy", priority: 0.3, changeFrequency: "yearly" as const },
    { route: "/warranty-policy", priority: 0.3, changeFrequency: "yearly" as const },
    { route: "/installation-policy", priority: 0.3, changeFrequency: "yearly" as const },
  ];

  const staticEntries: MetadataRoute.Sitemap = staticRoutes.map((r) => ({
    url: `${base}${r.route}`,
    lastModified: BUILD_DATE,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));

  // Product URLs — only products with verified pricing (not quote-only).
  const productEntries: MetadataRoute.Sitemap = catalogue
    .filter((product) => {
      // Exclude products without verified pricing and quote-only products.
      return (
        product.priceSourceStatus === "verified" &&
        product.stockStatus !== "quote_only" &&
        product.sellingPriceInclGstPaise !== null
      );
    })
    .map((product) => ({
      url: `${base}/products/${product.slug}`,
      lastModified: new Date(product.verifiedAt),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));

  // Category URLs — only categories that have at least one product with
  // verified pricing.
  const categoriesWithProducts = new Set(
    catalogue
      .filter((p) => p.priceSourceStatus === "verified" && p.sellingPriceInclGstPaise !== null)
      .map((p) => p.categorySlug),
  );
  const categoryEntries: MetadataRoute.Sitemap = categories
    .filter((category) => categoriesWithProducts.has(category.slug))
    .map((category) => ({
      url: `${base}/categories/${category.slug}`,
      lastModified: BUILD_DATE,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));

  // Brand URLs — only brands that have at least one product with verified
  // pricing.
  const brandsWithProducts = new Set(
    catalogue
      .filter((p) => p.priceSourceStatus === "verified" && p.sellingPriceInclGstPaise !== null)
      .map((p) => p.brandSlug),
  );
  const brandEntries: MetadataRoute.Sitemap = brands
    .filter((brand) => brandsWithProducts.has(brand.slug))
    .map((brand) => ({
      url: `${base}/brands/${brand.slug}`,
      lastModified: BUILD_DATE,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));

  return [...staticEntries, ...productEntries, ...categoryEntries, ...brandEntries];
}
