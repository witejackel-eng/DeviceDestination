/**
 * Production catalogue cache (M2B).
 *
 * **Server-only.** Implements the architecture selected in
 * `docs/adr/0001-catalogue-cache-architecture.md`:
 *
 *   getCachedCatalogue()        React cache()      — one load per render
 *     └ loadPersistentPayload() unstable_cache     — cross-request, tag "catalogue"
 *
 * `unstable_cache` is deprecated; this is the transitional bridge recorded in
 * the ADR, to be revisited after M5.
 *
 * ## The degraded bypass
 *
 * A snapshot with `authority === "static_degraded"` is the static catalogue
 * served because the database could not be reached. Persisting it would freeze
 * the fallback for the full authoritative lifetime after a momentary outage, so
 * it must never enter the persistent cache — not merely with a shorter life.
 *
 * `unstable_cache` fixes its lifetime at definition time and cannot branch on a
 * value it has not computed yet, so the bypass works the only way it can: the
 * cached callback throws a private sentinel carrying the already-redacted
 * payload, and a rejected callback leaves no cache entry behind. The outer
 * wrapper catches the sentinel and returns the degraded snapshot normally.
 *
 * This is verified against a real production runtime, not assumed — see the ADR.
 */

import { cache } from "react";
import { unstable_cache } from "next/cache";
import {
  CATALOGUE_CACHE_TAG,
  fromCachePayload,
  toCachePayload,
} from "@/data/catalogue-cache-payload";
import { getCatalogue } from "@/data/repository";
import type { CatalogueCachePayload, CatalogueSnapshot } from "@/data/catalogue-types";

/**
 * Single lifetime for every persisted snapshot.
 *
 * The ADR proposed per-authority lifetimes, but `unstable_cache` fixes
 * `revalidate` at definition time and the authority is only known after the
 * loader runs. Rather than fake several lifetimes, one safe value is used and
 * the deviation is documented:
 *
 *  - unconfigured bootstrap 3600s → 300s: no database cost, only re-running a
 *    static map slightly more often;
 *  - unseeded bootstrap 60s → 300s: newly seeded products may take up to five
 *    minutes to appear until M4 adds admin invalidation.
 *
 * Degraded snapshots are unaffected: they are never persisted at all.
 */
export const CATALOGUE_CACHE_REVALIDATE_SECONDS = 300;

/**
 * Private control-flow signal, never an error condition.
 *
 * Carries only the `CatalogueCachePayload`, which is already redacted: no raw
 * error, message, stack, SQL, credentials, environment value or database URL.
 * It never escapes this module and never reaches browser output.
 */
class DegradedCatalogueSignal {
  static readonly brand = Symbol.for("devicedestination.catalogue.degraded");
  readonly brand = DegradedCatalogueSignal.brand;
  readonly payload: CatalogueCachePayload;

  constructor(payload: CatalogueCachePayload) {
    this.payload = payload;
  }
}

/**
 * Branded rather than `instanceof`-only: a module evaluated twice (dev
 * recompiles, separate bundles) would otherwise produce two classes and a
 * degraded snapshot would be rethrown as an unexpected error.
 */
function isDegradedSignal(value: unknown): value is DegradedCatalogueSignal {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { brand?: unknown }).brand === DegradedCatalogueSignal.brand
  );
}

const loadPersistentPayload = unstable_cache(
  async (): Promise<CatalogueCachePayload> => {
    const snapshot = await getCatalogue();
    const payload = toCachePayload(snapshot);
    // Rejecting leaves no cache entry, which is the whole mechanism.
    if (snapshot.authority === "static_degraded") throw new DegradedCatalogueSignal(payload);
    return payload;
  },
  ["catalogue", "v1"],
  { tags: [CATALOGUE_CACHE_TAG], revalidate: CATALOGUE_CACHE_REVALIDATE_SECONDS },
);

/**
 * The catalogue for the current render.
 *
 * Deduplicated per render and persisted across requests unless degraded.
 * Never resolves to an empty catalogue for a failure state, and never persists
 * one for a degraded state.
 */
export const getCachedCatalogue: () => Promise<CatalogueSnapshot> = cache(async () => {
  try {
    return fromCachePayload(await loadPersistentPayload());
  } catch (error) {
    if (isDegradedSignal(error)) return fromCachePayload(error.payload);
    // A real failure — a bug, not a degraded database. Never silently converted
    // into a normal degraded result.
    throw error;
  }
});

/** True when the catalogue is authoritative but deliberately empty. */
export function isAuthoritativeEmpty(snapshot: CatalogueSnapshot): boolean {
  return snapshot.authority === "database" && snapshot.products.length === 0;
}

/** True when the displayed catalogue could not be verified against the database. */
export function isDegraded(snapshot: CatalogueSnapshot): boolean {
  return snapshot.authority === "static_degraded";
}
