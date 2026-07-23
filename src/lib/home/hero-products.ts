import { catalogue } from "@/data/catalog";
import type { Product } from "@/lib/products";
import { resolveHeroMedia } from "@/lib/home/hero-media";

export type HeroProductRole = "primary" | "secondary" | "tertiary";

export interface HeroProduct {
  product: Product;
  role: HeroProductRole;
  resolvedVia: string;
  /** Hero-media configuration for art-directed image, positioning, and scaling */
  heroMedia: ReturnType<typeof resolveHeroMedia>;
}

// Preferred models per role
const preferredModels: Record<HeroProductRole, string> = {
  primary: "CP-UNC-DA41L3C-D-Q",
  secondary: "CP-UNC-TA41L3C-Q",
  tertiary: "CP-UNR-108F1",
};

// Fallback chains per role
const fallbackFilters: Record<HeroProductRole, ((p: Product) => boolean)[]> = {
  primary: [
    (p) => p.categorySlug.includes("dome") && p.specs["Max resolution"]?.includes("4 MP") && p.stockStatus === "in_stock",
    (p) => p.categorySlug.includes("dome") && p.stockStatus === "in_stock",
  ],
  secondary: [
    (p) => p.categorySlug.includes("bullet") && p.specs["Max resolution"]?.includes("4 MP") && p.stockStatus === "in_stock",
    (p) => p.categorySlug.includes("bullet") && p.stockStatus === "in_stock",
  ],
  tertiary: [
    (p) => p.categorySlug.includes("nvr") && p.stockStatus === "in_stock",
    (p) => p.stockStatus === "in_stock",
  ],
};

export function resolveHeroProducts(): HeroProduct[] {
  const results: HeroProduct[] = [];
  const usedIds = new Set<string>();

  for (const role of ["primary", "secondary", "tertiary"] as HeroProductRole[]) {
    const preferred = preferredModels[role];
    const exact = catalogue.find(p => p.model === preferred && !usedIds.has(p.id));
    if (exact) {
      usedIds.add(exact.id);
      results.push({
        product: exact,
        role,
        resolvedVia: "exact",
        heroMedia: resolveHeroMedia(exact.model),
      });
      continue;
    }

    // Try fallbacks
    let found = false;
    for (const filterFn of fallbackFilters[role]) {
      const fallback = catalogue.find(p => filterFn(p) && !usedIds.has(p.id));
      if (fallback) {
        usedIds.add(fallback.id);
        results.push({
          product: fallback,
          role,
          resolvedVia: `fallback-${role}`,
          heroMedia: resolveHeroMedia(fallback.model),
        });
        found = true;
        break;
      }
    }

    if (!found) {
      console.warn(`[hero-products] Could not resolve ${role} product for hero. Using first available.`);
      const anyProduct = catalogue.find(p => !usedIds.has(p.id) && p.stockStatus === "in_stock");
      if (anyProduct) {
        usedIds.add(anyProduct.id);
        results.push({
          product: anyProduct,
          role,
          resolvedVia: "emergency-fallback",
          heroMedia: resolveHeroMedia(anyProduct.model),
        });
      }
    }
  }

  return results;
}

/**
 * Get the hero image path for a hero product.
 * Uses the hero-media optimized image if available, otherwise falls back
 * to the catalogue source image. NO MORE BLIND product.images[0].
 */
export function getHeroImage(heroProduct: HeroProduct): string {
  const media = heroProduct.heroMedia;
  if (media) {
    return media.optimizedImage;
  }
  // Fallback: use the best source image from the product gallery
  return heroProduct.product.images[0];
}

// Derive technical annotations from real product specs
export interface HeroAnnotation {
  label: string;
  value: string;
  source: HeroProductRole;
}

const annotationSpecs: Record<string, string[]> = {
  "4 MP": ["Max resolution", "Image Sensor"],
  "PoE": ["Power"],
  "IP67": ["IP Rating"],
};

export function deriveAnnotations(heroProducts: HeroProduct[]): HeroAnnotation[] {
  const primary = heroProducts.find(hp => hp.role === "primary");
  if (!primary) return [];

  const specs = primary.product.specs;
  const annotations: HeroAnnotation[] = [];

  for (const [label, specKeys] of Object.entries(annotationSpecs)) {
    for (const key of specKeys) {
      const value = specs[key];
      if (value) {
        if (label === "4 MP" && !value.match(/4\s*MP/i)) continue;
        if (label === "PoE" && !value.match(/PoE/i)) continue;
        if (label === "IP67" && value !== "IP67") continue;
        annotations.push({ label, value, source: "primary" });
        break;
      }
    }
  }

  return annotations.slice(0, 3);
}
