/**
 * Cache-safe catalogue payload (M2A).
 *
 * Proves the cached representation survives the JSON boundary both
 * `unstable_cache` and Cache Components impose, and that the runtime slug index
 * rebuilds correctly on read.
 */

import { describe, expect, it } from "vitest";
import {
  CATALOGUE_CACHE_PAYLOAD_VERSION,
  fromCachePayload,
  isSupportedCachePayload,
  toCachePayload,
} from "@/data/catalogue-cache-payload";
import { getCatalogue } from "@/data/repository";
import type { CatalogueSnapshot } from "@/data/catalogue-types";
import {
  CatalogueDatabaseError,
} from "@/data/catalogue-db-adapter";
import {
  fakeAdapter,
  productRow,
  queryResult,
  recordingLogger,
} from "@tests/helpers/catalogue-fixtures";

async function databaseSnapshot(): Promise<CatalogueSnapshot> {
  return getCatalogue({
    adapter: fakeAdapter({
      result: queryResult({
        products: [
          productRow({ slug: "cache-one", legacySlugs: ["cache-one-old"] }),
          productRow({ slug: "cache-two" }),
        ],
      }),
    }),
    logger: recordingLogger(),
  });
}

/**
 * Walk a value and report any structure JSON cannot carry.
 *
 * `ancestors` tracks the current path only, not everything visited: products
 * legitimately share array instances (two products with no enrichment hold the
 * same empty array), and a shared reference is not a cycle — JSON duplicates it
 * on write.
 */
function unserialisablePaths(value: unknown, path = "$", ancestors: unknown[] = []): string[] {
  if (value === null || typeof value !== "object") {
    return typeof value === "function" ? [`${path}: function`] : [];
  }
  if (ancestors.includes(value)) return [`${path}: circular`];

  if (value instanceof Map) return [`${path}: Map`];
  if (value instanceof Set) return [`${path}: Set`];
  if (value instanceof Date) return [`${path}: Date`];
  if (value instanceof Error) return [`${path}: Error`];

  const nextAncestors = [...ancestors, value];
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) =>
      unserialisablePaths(entry, `${path}[${index}]`, nextAncestors),
    );
  }
  return Object.entries(value).flatMap(([key, entry]) =>
    unserialisablePaths(entry, `${path}.${key}`, nextAncestors),
  );
}

describe("catalogue cache payload", () => {
  it("detects unserialisable structures, proving the check is not vacuous", () => {
    expect(unserialisablePaths({ a: new Map() })).toEqual(["$.a: Map"]);
    expect(unserialisablePaths({ a: [new Date()] })).toEqual(["$.a[0]: Date"]);
    expect(unserialisablePaths({ a: () => 1 })).toEqual(["$.a: function"]);
    expect(unserialisablePaths({ a: new Error("x") })).toEqual(["$.a: Error"]);
    const shared = [1, 2];
    expect(unserialisablePaths({ a: shared, b: shared })).toEqual([]);
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    expect(unserialisablePaths(cyclic)).toEqual(["$.self: circular"]);
  });

  it("contains no Map, Set, Date, Error or function", async () => {
    const payload = toCachePayload(await databaseSnapshot());

    expect(unserialisablePaths(payload)).toEqual([]);
    expect("bySlug" in payload).toBe(false);
  });

  it("drops the runtime index and raw diagnostic text, keeping counts", async () => {
    const snapshot = await getCatalogue({
      adapter: fakeAdapter({
        result: queryResult({
          products: [
            productRow({ slug: "kept-product", model: "ADMIN-ONLY-CACHE-1" }),
            productRow({ slug: "", model: "" }),
          ],
        }),
      }),
      logger: recordingLogger(),
    });
    const payload = toCachePayload(snapshot);

    expect(snapshot.diagnostics.length).toBeGreaterThan(0);
    expect(payload.diagnosticCounts.product_excluded).toBe(1);
    // Counts only — no per-request message text is persisted.
    expect(JSON.stringify(payload)).not.toContain("excluded from database catalogue");
  });

  it("survives a JSON round trip unchanged", async () => {
    const payload = toCachePayload(await databaseSnapshot(), { cachedAt: "2026-07-26T00:00:00.000Z" });
    const revived = JSON.parse(JSON.stringify(payload));

    expect(revived).toEqual(payload);
  });

  it("reconstructs the slug index after deserialisation", async () => {
    const original = await databaseSnapshot();
    const payload = toCachePayload(original);
    const revived = fromCachePayload(JSON.parse(JSON.stringify(payload)));

    expect(revived.products.map((product) => product.slug)).toEqual(
      original.products.map((product) => product.slug),
    );
    expect(revived.bySlug.get("cache-one")?.slug).toBe("cache-one");
    // Legacy slugs resolve through the rebuilt index too.
    expect(revived.bySlug.get("cache-one-old")?.slug).toBe("cache-one");
    expect(revived.bySlug.size).toBe(original.bySlug.size);
    expect(revived.source).toBe("database");
    expect(revived.authority).toBe("database");
    expect(revived.pricingAuthority).toBe("database");
  });

  it("preserves the degraded marker through the cache boundary", async () => {
    const snapshot = await getCatalogue({
      adapter: fakeAdapter({ error: new CatalogueDatabaseError("query_failed", "NeonDbError") }),
      logger: recordingLogger(),
    });
    const revived = fromCachePayload(JSON.parse(JSON.stringify(toCachePayload(snapshot))));

    // A route reading this from cache must still know it is not authoritative.
    expect(revived.authority).toBe("static_degraded");
    expect(revived.pricingAuthority).toBe("unverified");
    expect(revived.reason).toBe("query_failed");
    expect(revived.diagnostics).toHaveLength(1);
    expect(revived.diagnostics[0].code).toBe("query_failed");
  });

  it("preserves an authoritative empty catalogue through the cache boundary", async () => {
    const snapshot = await getCatalogue({
      adapter: fakeAdapter({ result: queryResult({ totalProductCount: 9 }) }),
      logger: recordingLogger(),
    });
    const revived = fromCachePayload(JSON.parse(JSON.stringify(toCachePayload(snapshot))));

    expect(revived.authority).toBe("database");
    expect(revived.reason).toBe("no_published_products");
    expect(revived.products).toEqual([]);
    expect(revived.bySlug.size).toBe(0);
  });

  it("rejects a payload written by a different shape version", async () => {
    const payload = toCachePayload(await databaseSnapshot());

    expect(isSupportedCachePayload(payload)).toBe(true);
    expect(isSupportedCachePayload({ ...payload, version: 0 })).toBe(false);
    expect(isSupportedCachePayload(null)).toBe(false);
    expect(isSupportedCachePayload({ version: CATALOGUE_CACHE_PAYLOAD_VERSION })).toBe(false);
  });
});
