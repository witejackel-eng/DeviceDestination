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
import { normalizeModel, type Product } from "@/lib/products";
import type {
  CatalogueDocument,
  CatalogueEnrichedField,
  CatalogueEnrichmentSource,
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
    enrichmentSource: null,
    searchText: buildSearchText(product),
  };
}

let staticCatalogueCache: CatalogueProduct[] | null = null;

/** The complete static fallback catalogue. */
export function getStaticCatalogue(): CatalogueProduct[] {
  if (!staticCatalogueCache) staticCatalogueCache = catalogue.map(toCatalogueProduct);
  return staticCatalogueCache;
}

// ─── Enrichment identity resolution ───────────────────────────────────────

/**
 * Identity of a database product, used to find its static counterpart.
 * Only exact identifiers are compared — never a product name or description.
 */
export type EnrichmentIdentity = {
  slug: string;
  legacySlugs: readonly string[];
  model: string;
};

export type EnrichmentResolution = {
  enrichment: CatalogueEnrichment;
  source: CatalogueEnrichmentSource;
  /** Set when two or more static products claimed the same identity. */
  ambiguousVia: "legacy_slug" | "model" | null;
};

type EnrichmentIndex = {
  /** Static canonical slug → product index. */
  byCanonicalSlug: Map<string, number>;
  /** Static legacy slug → product indexes. Arrays because collisions are possible. */
  byLegacySlug: Map<string, number[]>;
  /** Normalised static model → product indexes. */
  byModel: Map<string, number[]>;
  entries: CatalogueEnrichment[];
};

let enrichmentIndexCache: EnrichmentIndex | null = null;

function pushIndex(map: Map<string, number[]>, key: string, index: number): void {
  const existing = map.get(key);
  if (existing) existing.push(index);
  else map.set(key, [index]);
}

function getEnrichmentIndex(): EnrichmentIndex {
  if (enrichmentIndexCache) return enrichmentIndexCache;
  const index: EnrichmentIndex = {
    byCanonicalSlug: new Map(),
    byLegacySlug: new Map(),
    byModel: new Map(),
    entries: [],
  };
  catalogue.forEach((product, position) => {
    index.entries.push({
      useCases: product.useCases,
      relatedProductIds: product.relatedProductIds,
      builderExclusions: product.builderExclusions,
      images: product.images,
      builderCompatibleIds: product.builderCompatibleIds,
    });
    // Canonical slugs are unique by catalogue invariant, enforced by
    // `validateProductCatalogue`; first write wins if that ever regresses.
    if (!index.byCanonicalSlug.has(product.slug))
      index.byCanonicalSlug.set(product.slug, position);
    for (const legacySlug of product.legacySlugs) pushIndex(index.byLegacySlug, legacySlug, position);
    pushIndex(index.byModel, normalizeModel(product.model), position);
  });
  enrichmentIndexCache = index;
  return index;
}

function unique(positions: readonly number[]): number[] {
  return [...new Set(positions)];
}

/**
 * Resolve a database product to its static counterpart.
 *
 * Precedence, deliberately strict:
 *
 *  1. Exact canonical slug.
 *  2. Unique exact legacy-slug match — the database slug against static legacy
 *     slugs, the database legacy slugs against static canonical slugs, or an
 *     intersection of the two legacy sets.
 *  3. Unique exact model match, compared under `normalizeModel` (the same form
 *     `validateProductCatalogue` uses to prove models are unique).
 *  4. Nothing.
 *
 * Two or more candidates at step 2 or 3 is an ambiguity, never a guess: no
 * enrichment is applied and the caller emits a diagnostic. The database product
 * is always kept either way.
 */
export function resolveEnrichment(identity: EnrichmentIdentity): EnrichmentResolution {
  const index = getEnrichmentIndex();

  const canonical = index.byCanonicalSlug.get(identity.slug);
  if (canonical !== undefined) {
    return { enrichment: index.entries[canonical], source: "canonical_slug", ambiguousVia: null };
  }

  const legacyCandidates: number[] = [
    // Database canonical slug recorded as a legacy slug on a static product.
    ...(index.byLegacySlug.get(identity.slug) ?? []),
    ...identity.legacySlugs.flatMap((legacySlug) => [
      // Database legacy slug that is still a static canonical slug.
      ...(index.byCanonicalSlug.has(legacySlug) ? [index.byCanonicalSlug.get(legacySlug)!] : []),
      // Both sides retired the same slug.
      ...(index.byLegacySlug.get(legacySlug) ?? []),
    ]),
  ];
  const legacyMatches = unique(legacyCandidates);
  if (legacyMatches.length === 1) {
    return {
      enrichment: index.entries[legacyMatches[0]],
      source: "legacy_slug",
      ambiguousVia: null,
    };
  }
  if (legacyMatches.length > 1) {
    return { enrichment: EMPTY_ENRICHMENT, source: "ambiguous", ambiguousVia: "legacy_slug" };
  }

  const modelMatches = unique(index.byModel.get(normalizeModel(identity.model)) ?? []);
  if (modelMatches.length === 1) {
    return { enrichment: index.entries[modelMatches[0]], source: "model", ambiguousVia: null };
  }
  if (modelMatches.length > 1) {
    return { enrichment: EMPTY_ENRICHMENT, source: "ambiguous", ambiguousVia: "model" };
  }

  return { enrichment: EMPTY_ENRICHMENT, source: "none", ambiguousVia: null };
}

/** Test seam — the caches above are module-level and would otherwise leak between suites. */
export function resetStaticCatalogueCaches(): void {
  staticCatalogueCache = null;
  enrichmentIndexCache = null;
}
