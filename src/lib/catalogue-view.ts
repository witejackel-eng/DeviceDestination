/**
 * Pure catalogue projections and derivations (M2B).
 *
 * These take a product collection as an argument instead of importing the
 * static catalogue, so server routes can pass whatever the canonical repository
 * returned. No database, no framework, no module-level state — which also makes
 * them directly testable.
 */

import { normaliseSearchTerm, type Product } from "@/lib/products";
import type { CatalogueProduct, CatalogueSnapshot } from "@/data/catalogue-types";

export type TaxonomyEntry = { slug: string; name: string };

/**
 * Resolve a product from a snapshot: canonical slug, then legacy slug, then
 * exact model — the same order the repository itself uses.
 *
 * Returns `undefined` when the authoritative catalogue holds no such product.
 * Nothing is resurrected from static data, so a product unpublished or deleted
 * in admin genuinely disappears from the storefront.
 */
export function resolveProductFromSnapshot(
  snapshot: Pick<CatalogueSnapshot, "bySlug" | "products">,
  slug: string,
): CatalogueProduct | undefined {
  return snapshot.bySlug.get(slug) ?? snapshot.products.find((product) => product.model === slug);
}

/**
 * Narrow a repository product back to the shared public contract.
 *
 * Client components receive this rather than the full `CatalogueProduct`, so
 * M2B does not push `specGroups`, `imageDetails`, `documentDetails`,
 * `compatibility`, `inventory` or `searchText` into the browser bundle. M3
 * designs the genuinely minimal per-component projections; this only holds the
 * client payload at its current size in the meantime.
 */
export function toPublicProduct(product: CatalogueProduct): Product {
  return {
    id: product.id,
    slug: product.slug,
    legacySlugs: product.legacySlugs,
    model: product.model,
    brand: product.brand,
    brandSlug: product.brandSlug,
    category: product.category,
    categorySlug: product.categorySlug,
    title: product.title,
    shortDescription: product.shortDescription,
    longDescription: product.longDescription,
    images: product.images,
    imageModel: product.imageModel,
    documents: product.documents,
    specs: product.specs,
    highlights: product.highlights,
    useCases: product.useCases,
    stockStatus: product.stockStatus,
    sellingPriceInclGstPaise: product.sellingPriceInclGstPaise,
    mrpInclGstPaise: product.mrpInclGstPaise,
    compareAtPriceInclGstPaise: product.compareAtPriceInclGstPaise,
    compareAtLabel: product.compareAtLabel,
    gstRateBasisPoints: product.gstRateBasisPoints,
    gstIncluded: product.gstIncluded,
    priceVerifiedAt: product.priceVerifiedAt,
    priceSourceStatus: product.priceSourceStatus,
    officialSourceUrl: product.officialSourceUrl,
    verifiedAt: product.verifiedAt,
    warrantySummary: product.warrantySummary,
    relatedProductIds: product.relatedProductIds,
    builderCompatibleIds: product.builderCompatibleIds,
    builderExclusions: product.builderExclusions,
  };
}

export function toPublicProducts(products: readonly CatalogueProduct[]): Product[] {
  return products.map(toPublicProduct);
}

/** Categories present in the given products, in first-appearance order. */
export function deriveCategories(products: readonly CatalogueProduct[]): TaxonomyEntry[] {
  return Array.from(
    new Map(products.map((product) => [product.categorySlug, product.category])).entries(),
  ).map(([slug, name]) => ({ slug, name }));
}

/** Brands present in the given products, in first-appearance order. */
export function deriveBrands(products: readonly CatalogueProduct[]): TaxonomyEntry[] {
  return Array.from(
    new Map(products.map((product) => [product.brandSlug, product.brand])).entries(),
  ).map(([slug, name]) => ({ slug, name }));
}

/**
 * Relevance-ranked search over a supplied collection.
 *
 * Scoring is carried over unchanged from `searchProducts` in `@/data/catalog`
 * so query behaviour does not shift during the cutover. Uses the repository's
 * precomputed `searchText` rather than rebuilding the corpus per product.
 */
export function searchCatalogue(
  products: readonly CatalogueProduct[],
  query: string,
): CatalogueProduct[] {
  const normalized = query.trim().toLowerCase();
  const compact = normaliseSearchTerm(query);
  if (!normalized) return [...products];

  return products
    .flatMap((product) => {
      const text = product.searchText;
      const compactModel = normaliseSearchTerm(product.model);
      const compactText = normaliseSearchTerm(text);
      if (!text.includes(normalized) && !compactText.includes(compact)) return [];
      const score =
        compactModel === compact
          ? 1_000
          : compactModel.startsWith(compact)
            ? 800
            : compactModel.includes(compact)
              ? 650
              : product.title.toLowerCase().includes(normalized)
                ? 300
                : 100;
      return [{ product, score }];
    })
    .sort((a, b) => b.score - a.score || a.product.model.localeCompare(b.product.model))
    .map(({ product }) => product);
}
