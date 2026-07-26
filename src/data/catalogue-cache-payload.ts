/**
 * Cross-request cache representation of a catalogue snapshot (M2A).
 *
 * A `CatalogueSnapshot` carries a `Map` (`bySlug`) and full diagnostic objects.
 * Neither belongs in a cross-request cache: a `Map` does not survive the JSON
 * boundary that both `unstable_cache` and Cache Components impose, and raw
 * diagnostics carry runtime detail that has no value once the request is over.
 *
 * So the cached form is deliberately narrow and JSON-safe, and the runtime
 * index is rebuilt on read. This module is pure — no database, no logger, no
 * framework import — so it can be exercised without either cache implementation
 * and reused whichever strategy M2B selects.
 */

import type {
  CatalogueCachePayload,
  CatalogueDiagnostic,
  CatalogueDiagnosticCode,
  CatalogueProduct,
  CatalogueSnapshot,
} from "@/data/catalogue-types";

export const CATALOGUE_CACHE_PAYLOAD_VERSION = 1 as const;

/** The single cache tag for the catalogue. See the ADR for why there is only one. */
export const CATALOGUE_CACHE_TAG = "catalogue";

function countDiagnostics(
  diagnostics: readonly CatalogueDiagnostic[],
): Partial<Record<CatalogueDiagnosticCode, number>> {
  const counts: Partial<Record<CatalogueDiagnosticCode, number>> = {};
  for (const diagnostic of diagnostics) {
    counts[diagnostic.code] = (counts[diagnostic.code] ?? 0) + 1;
  }
  return counts;
}

function indexBySlug(products: readonly CatalogueProduct[]): Map<string, CatalogueProduct> {
  const index = new Map<string, CatalogueProduct>();
  for (const product of products) index.set(product.slug, product);
  for (const product of products) {
    for (const legacySlug of product.legacySlugs) {
      if (!index.has(legacySlug)) index.set(legacySlug, product);
    }
  }
  return index;
}

/**
 * Reduce a snapshot to its cacheable form.
 *
 * Dropped on purpose: `bySlug` (a `Map`), and diagnostic messages — only the
 * count per typed code survives, which is enough to answer "was this snapshot
 * degraded, and how badly" without persisting per-request text.
 */
export function toCachePayload(
  snapshot: CatalogueSnapshot,
  options: { cachedAt?: string } = {},
): CatalogueCachePayload {
  return {
    version: CATALOGUE_CACHE_PAYLOAD_VERSION,
    source: snapshot.source,
    reason: snapshot.reason,
    authority: snapshot.authority,
    pricingAuthority: snapshot.pricingAuthority,
    products: snapshot.products,
    productCount: snapshot.products.length,
    diagnosticCounts: countDiagnostics(snapshot.diagnostics),
    cachedAt: options.cachedAt ?? new Date().toISOString(),
  };
}

/**
 * Rebuild a usable snapshot from a cached payload, reconstructing the slug
 * index. Diagnostics come back as a single summary entry rather than fabricated
 * per-product detail — the originals belonged to the request that produced them.
 */
export function fromCachePayload(payload: CatalogueCachePayload): CatalogueSnapshot {
  // A healthy database snapshot has nothing to report. Anything else keeps one
  // summary line naming the state it was cached in, so a route reading a cached
  // degraded snapshot can still tell that it is degraded.
  const diagnostics: CatalogueDiagnostic[] =
    payload.reason === "database"
      ? []
      : [{ code: payload.reason, message: `served from cache stored at ${payload.cachedAt}` }];

  return {
    source: payload.source,
    reason: payload.reason,
    authority: payload.authority,
    pricingAuthority: payload.pricingAuthority,
    products: payload.products,
    bySlug: indexBySlug(payload.products),
    diagnostics,
  };
}

/** A payload is only usable if it was written by this version of the shape. */
export function isSupportedCachePayload(value: unknown): value is CatalogueCachePayload {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { version?: unknown }).version === CATALOGUE_CACHE_PAYLOAD_VERSION &&
    Array.isArray((value as { products?: unknown }).products)
  );
}
