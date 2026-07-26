/**
 * Static catalogue adapter (M1).
 *
 * Two responsibilities:
 *
 *  1. Present the static catalogue as `CatalogueProduct[]` so the fallback path
 *     satisfies exactly the same contract as the database path.
 *  2. Provide the slug-keyed enrichment index used to fill public fields the
 *     current schema does not represent (`useCases`, `relatedProductIds`,
 *     `builderExclusions`) on database-backed products.
 *
 * Enrichment never touches pricing, publication or inventory. A database
 * product with no static counterpart is fully valid and receives empty arrays.
 *
 * This module is serialisable and free of database imports.
 */

import { catalogue } from "@/data/catalog";
import type { Product } from "@/lib/products";
import type {
  CatalogueDocument,
  CatalogueEnrichedField,
  CatalogueImage,
  CatalogueProduct,
  CatalogueSpecGroup,
} from "@/data/catalogue-types";

/** Rendered when a product has no image in the database and no static counterpart. */
export const PLACEHOLDER_IMAGE_URL = "/images/products/placeholder.svg";

export const DEFAULT_SPEC_GROUP = "General";

/** Public fields the schema cannot store. Kept in one place so the docs and code agree. */
export const STATIC_ENRICHMENT_FIELDS: readonly CatalogueEnrichedField[] = [
  "useCases",
  "relatedProductIds",
  "builderExclusions",
] as const;

export type CatalogueEnrichment = {
  useCases: string[];
  relatedProductIds: string[];
  builderExclusions: string[];
  /** Used only as an image fallback, never to override database images. */
  images: string[];
  /** Used only when the database holds no compatibility rows for the product. */
  builderCompatibleIds: string[];
};

const EMPTY_ENRICHMENT: CatalogueEnrichment = {
  useCases: [],
  relatedProductIds: [],
  builderExclusions: [],
  images: [],
  builderCompatibleIds: [],
};

export function buildSearchText(
  product: Pick<
    Product,
    "title" | "model" | "brand" | "category" | "shortDescription" | "highlights" | "useCases"
  > & { specs: Record<string, string> },
): string {
  return [
    product.title,
    product.model,
    product.brand,
    product.category,
    product.shortDescription,
    ...product.highlights,
    ...product.useCases,
    ...Object.entries(product.specs).flatMap(([label, value]) => [label, value]),
  ]
    .join(" ")
    .toLowerCase();
}

function staticSpecGroups(specs: Record<string, string>): CatalogueSpecGroup[] {
  const rows = Object.entries(specs).map(([label, value], index) => ({
    label,
    value,
    position: index,
  }));
  if (rows.length === 0) return [];
  return [{ name: DEFAULT_SPEC_GROUP, position: 0, rows }];
}

function staticImageDetails(product: Product): CatalogueImage[] {
  return product.images.map((url, index) => ({
    url,
    alt: `${product.title} — view ${index + 1}`,
    position: index,
    isPrimary: index === 0,
  }));
}

function staticDocumentDetails(product: Product): CatalogueDocument[] {
  // Static documents are curated and model-checked by `validateProductCatalogue`,
  // so they are treated as verified.
  return product.documents.map((document) => ({ ...document, modelVerified: true }));
}

/** Present one static catalogue entry as a `CatalogueProduct`. */
export function toCatalogueProduct(product: Product): CatalogueProduct {
  return {
    ...product,
    source: "static",
    databaseId: null,
    specGroups: staticSpecGroups(product.specs),
    imageDetails: staticImageDetails(product),
    documentDetails: staticDocumentDetails(product),
    compatibility: product.builderCompatibleIds.map((compatibleProductId) => ({
      compatibleProductId,
      note: null,
    })),
    inventory: null,
    // In static mode these fields are native to the source, not enrichment.
    enrichedFields: [],
    searchText: buildSearchText(product),
  };
}

let staticCatalogueCache: CatalogueProduct[] | null = null;

/** The complete static fallback catalogue. */
export function getStaticCatalogue(): CatalogueProduct[] {
  if (!staticCatalogueCache) staticCatalogueCache = catalogue.map(toCatalogueProduct);
  return staticCatalogueCache;
}

let enrichmentIndexCache: Map<string, CatalogueEnrichment> | null = null;

/**
 * Slug-keyed enrichment index. Legacy slugs resolve to the same entry so a
 * renamed database product still matches its static counterpart.
 */
export function getEnrichmentIndex(): Map<string, CatalogueEnrichment> {
  if (enrichmentIndexCache) return enrichmentIndexCache;
  const index = new Map<string, CatalogueEnrichment>();
  for (const product of catalogue) {
    const entry: CatalogueEnrichment = {
      useCases: product.useCases,
      relatedProductIds: product.relatedProductIds,
      builderExclusions: product.builderExclusions,
      images: product.images,
      builderCompatibleIds: product.builderCompatibleIds,
    };
    index.set(product.slug, entry);
    for (const legacySlug of product.legacySlugs) index.set(legacySlug, entry);
  }
  enrichmentIndexCache = index;
  return index;
}

export function getEnrichment(slug: string): CatalogueEnrichment {
  return getEnrichmentIndex().get(slug) ?? EMPTY_ENRICHMENT;
}

/** Test seam — the caches above are module-level and would otherwise leak between suites. */
export function resetStaticCatalogueCaches(): void {
  staticCatalogueCache = null;
  enrichmentIndexCache = null;
}
