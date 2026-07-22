import type { MetadataRoute } from "next";
import { brands, catalogue, categories } from "@/data/catalog";
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.devicedestination.com";
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
  return [
    ...routes.map((route) => ({
      url: `${base}${route}`,
      lastModified: new Date(),
      changeFrequency: route === "/products" ? ("daily" as const) : ("monthly" as const),
      priority: route === "" ? 1 : 0.7,
    })),
    ...catalogue.map((product) => ({
      url: `${base}/products/${product.slug}`,
      lastModified: new Date(product.verifiedAt),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...categories.map((category) => ({
      url: `${base}/categories/${category.slug}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
    ...brands.map((brand) => ({
      url: `${base}/brands/${brand.slug}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
