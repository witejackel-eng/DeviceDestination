import type { MetadataRoute } from "next";
import { getCachedCatalogue } from "@/data/catalogue-cache";
import { deriveBrands, deriveCategories } from "@/lib/catalogue-view";
import { siteConfig } from "@/config/site";

// Request-time generated so the sitemap follows the canonical catalogue rather
// than freezing a build-time fallback into the deployment. A degraded snapshot
// is never persisted by the cache, so a database outage cannot pin a fallback
// sitemap for the authoritative lifetime.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteConfig.url;
  const routes = [
    "",
    "/products",
    "/system-builder",
    "/downloads",
    "/about",
    "/contact",
    "/support",
    "/quote",
    "/privacy",
    "/terms",
    "/shipping-policy",
    "/refund-policy",
    "/warranty-policy",
    "/installation-policy",
  ];

  const snapshot = await getCachedCatalogue();
  // Only the canonical catalogue is listed. Unpublished and integrity-excluded
  // products never reach `snapshot.products`, and legacy slugs are deliberately
  // omitted — they redirect to the canonical URL rather than being pages.
  const products = snapshot.products;

  return [
    ...routes.map((route) => ({
      url: `${base}${route}`,
      lastModified: new Date(),
      changeFrequency: route === "/products" ? ("daily" as const) : ("monthly" as const),
      priority: route === "" ? 1 : 0.7,
    })),
    ...products.map((product) => ({
      url: `${base}/products/${product.slug}`,
      lastModified: new Date(product.verifiedAt),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...deriveCategories(products).map((category) => ({
      url: `${base}/categories/${category.slug}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...deriveBrands(products).map((brand) => ({
      url: `${base}/brands/${brand.slug}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
