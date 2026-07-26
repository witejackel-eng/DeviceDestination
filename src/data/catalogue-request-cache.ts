/**
 * Request-scoped catalogue memoisation (M2A, Layer A).
 *
 * **Server-only.** Wraps `getCatalogue` in React's `cache()` so several
 * selectors used during one server render share a single catalogue load. This
 * is deduplication, not caching: React clears the memo when the request ends,
 * so nothing survives to the next request and no stale data can leak between
 * visitors.
 *
 * Measured limitation: `cache()` only memoises inside an active React render.
 * Outside one — a script, a unit test, a background job — it is a passthrough
 * and every call reaches the database. That is why this module has no unit test
 * asserting deduplication; the proof is a real render, recorded in
 * `docs/adr/0001-catalogue-cache-architecture.md`. Never rely on it outside a
 * request.
 *
 * Deliberately takes no options: a per-request memo keyed on nothing is only
 * safe when every caller wants the same catalogue. Tests and scripts that need
 * an injected adapter call `getCatalogue` directly.
 */

import { cache } from "react";
import { getCatalogue } from "@/data/repository";
import type { CatalogueProduct, CatalogueSnapshot } from "@/data/catalogue-types";

/** One catalogue load per server render, shared by every selector below. */
export const getRequestCatalogue: () => Promise<CatalogueSnapshot> = cache(async () =>
  getCatalogue(),
);

export async function getRequestProducts(): Promise<CatalogueProduct[]> {
  return (await getRequestCatalogue()).products;
}

export async function getRequestProduct(slug: string): Promise<CatalogueProduct | undefined> {
  const snapshot = await getRequestCatalogue();
  return snapshot.bySlug.get(slug) ?? snapshot.products.find((product) => product.model === slug);
}
