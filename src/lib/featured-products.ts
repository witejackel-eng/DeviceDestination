import type { Product } from "@/lib/products";

/**
 * Curated featured-product selection that communicates the breadth of the store.
 * Uses catalogue lookups by model or category.
 * Filter out unavailable products, use category-based fallbacks when an exact model is not available.
 * Never show the same product twice. Never show inaccurate prices.
 */

const preferredModels = [
  "CP-UNC-DA41L3C-D-Q", // 4 MP dome camera
  "CP-UNC-TA41L3C-Q",   // 4 MP bullet camera
  "CP-UNC-DA41L3C-LQ",  // Full-colour dome camera
  "CP-UNC-DA21L3C-Q",   // Entry-level 2 MP dome camera
  "CP-UNR-108F1",       // 8-channel NVR
  "CP-UNR-4K2161-V2",   // 16-channel 4K NVR
];

/* Biometric: X990 or F22+ID+WIFI */
const preferredBiometricModels = ["X990", "F22+ID+WIFI"];

/* PoE switch: strongest verified in-stock */
const preferredSwitchModels = ["GS108PP", "GS116PP"];

/**
 * Curated featured selection drawn from a supplied collection rather than the
 * static catalogue, so the homepage uses one canonical snapshot throughout.
 */
export function getFeaturedProducts(catalogue: readonly Product[], max = 8): Product[] {
  const selected: Product[] = [];
  const selectedIds = new Set<string>();

  function addByModel(model: string): boolean {
    const product = catalogue.find(
      (p) =>
        p.model === model &&
        !selectedIds.has(p.id) &&
        p.stockStatus === "in_stock"
    );
    if (product) {
      selected.push(product);
      selectedIds.add(product.id);
      return true;
    }
    return false;
  }

  function addByCategoryFallback(categorySlug: string): boolean {
    const product = catalogue.find(
      (p) =>
        p.categorySlug.includes(categorySlug) &&
        !selectedIds.has(p.id) &&
        p.stockStatus === "in_stock"
    );
    if (product) {
      selected.push(product);
      selectedIds.add(product.id);
      return true;
    }
    return false;
  }

  /* Primary cameras */
  for (const model of preferredModels) {
    if (selected.length >= max) break;
    addByModel(model);
  }

  /* Biometric fallback */
  if (selected.length < max) {
    let added = false;
    for (const model of preferredBiometricModels) {
      if (addByModel(model)) { added = true; break; }
    }
    if (!added) addByCategoryFallback("biometric");
  }

  /* PoE switch fallback */
  if (selected.length < max) {
    let added = false;
    for (const model of preferredSwitchModels) {
      if (addByModel(model)) { added = true; break; }
    }
    if (!added) addByCategoryFallback("switch");
  }

  return selected.slice(0, max);
}
