/**
 * Canonical server-side catalogue repository (M1).
 *
 * **Server-only.** Reaches the database through `catalogue-db-adapter`, which
 * imports `@/db/client`. Client components must import product *types* from
 * `@/lib/products` or `@/data/catalogue-types`, never this module.
 *
 * The database is canonical whenever it holds at least one usable published
 * product. The static catalogue is a complete fallback for every other state —
 * unconfigured, unreachable, failing, empty, or entirely unusable — so a
 * misconfigured deployment degrades to the full shop rather than an empty one.
 *
 * M1 adds no caching. `getCatalogue()` is the single load path and is the
 * function M2 will wrap in `unstable_cache` with catalogue tags.
 */

import {
  CatalogueDatabaseError,
  causeNameOf,
  drizzleCatalogueAdapter,
} from "@/data/catalogue-db-adapter";
import { mapDatabaseCatalogue } from "@/data/catalogue-mapping";
import { getStaticCatalogue } from "@/data/catalogue-static";
import { logger } from "@/lib/logger";
import type {
  CatalogueDatabaseAdapter,
  CatalogueDiagnostic,
  CatalogueLogger,
  CatalogueProduct,
  CatalogueRepositoryOptions,
  CatalogueSnapshot,
  CatalogueSourceReason,
  CatalogueTaxonomyEntry,
} from "@/data/catalogue-types";

export type {
  CatalogueDiagnostic,
  CatalogueProduct,
  CatalogueSnapshot,
  CatalogueSourceKind,
  CatalogueSourceReason,
  CatalogueTaxonomyEntry,
} from "@/data/catalogue-types";

const DEFAULT_FAILURE_COOLDOWN_MS = 30_000;

/**
 * Set after a connection or configuration failure so a down database is not
 * re-dialled once per server component render. Query failures are not memoised
 * — they may be transient and the next request should be allowed to try.
 *
 * Keyed by adapter instance rather than held in a single module variable: the
 * production adapter is a singleton so behaviour is unchanged, while a failing
 * adapter in one test can no longer suppress an unrelated adapter elsewhere.
 */
let cooldowns = new WeakMap<CatalogueDatabaseAdapter, number>();

const defaultLogger: CatalogueLogger = {
  debug: (payload, message) => logger.debug(payload, message),
  warn: (payload, message) => logger.warn(payload, message),
  error: (payload, message) => logger.error(payload, message),
};

/** Test seam. Module-level failure memoisation would otherwise leak between suites. */
export function resetCatalogueRepositoryState(): void {
  cooldowns = new WeakMap();
}

// ─── Snapshot assembly ────────────────────────────────────────────────────

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
 * Static data serving legitimately — no database configured, or a configured
 * database with no products at all yet. The full catalogue is restored.
 */
function bootstrapSnapshot(
  reason: CatalogueSourceReason,
  diagnostics: CatalogueDiagnostic[],
): CatalogueSnapshot {
  const products = getStaticCatalogue();
  return {
    source: "static",
    reason,
    authority: "static_bootstrap",
    pricingAuthority: "unverified",
    products,
    bySlug: indexBySlug(products),
    diagnostics,
  };
}

/**
 * Static data serving because the database could not be reached or read. The
 * catalogue is displayable but nothing in it was verified this request, so M2B
 * route code can surface a degraded-state notice and no caller may treat these
 * prices as authoritative.
 */
function degradedSnapshot(
  reason: CatalogueSourceReason,
  diagnostics: CatalogueDiagnostic[],
): CatalogueSnapshot {
  const products = getStaticCatalogue();
  return {
    source: "static",
    reason,
    authority: "static_degraded",
    pricingAuthority: "unverified",
    products,
    bySlug: indexBySlug(products),
    diagnostics,
  };
}

/**
 * The database decided the contents — including deciding they are empty.
 * An administrator who unpublishes every product gets an empty shop; the
 * historical static catalogue is never republished on their behalf.
 */
function databaseSnapshot(
  reason: CatalogueSourceReason,
  products: CatalogueProduct[],
  diagnostics: CatalogueDiagnostic[],
): CatalogueSnapshot {
  return {
    source: "database",
    reason,
    authority: "database",
    pricingAuthority: "database",
    products,
    bySlug: indexBySlug(products),
    diagnostics,
  };
}

function emit(log: CatalogueLogger, diagnostic: CatalogueDiagnostic): void {
  const payload = {
    event: "catalogue_repository",
    code: diagnostic.code,
    ...(diagnostic.productId ? { productId: diagnostic.productId } : {}),
  };
  switch (diagnostic.code) {
    // Expected, non-actionable states. A product created in admin with no
    // static counterpart must not fill the logs with warnings.
    case "database_not_configured":
    case "enrichment_matched_legacy_slug":
    case "enrichment_matched_model":
    case "enrichment_absent":
    case "image_placeholder_applied":
      log.debug(payload, diagnostic.message);
      return;
    case "database_unavailable":
    case "configuration_check_failed":
    case "query_failed":
      log.error(payload, diagnostic.message);
      return;
    default:
      log.warn(payload, diagnostic.message);
  }
}

// ─── Source selection ─────────────────────────────────────────────────────

/**
 * Load the catalogue, choosing between the database and the static fallback.
 * Never throws: every failure path resolves to a usable catalogue.
 */
export async function getCatalogue(
  options: CatalogueRepositoryOptions = {},
): Promise<CatalogueSnapshot> {
  const adapter = options.adapter ?? drizzleCatalogueAdapter;
  const log = options.logger ?? defaultLogger;
  const now = options.now ?? Date.now;
  const cooldownMs = options.failureCooldownMs ?? DEFAULT_FAILURE_COOLDOWN_MS;
  const diagnostics: CatalogueDiagnostic[] = [];

  const record = (diagnostic: CatalogueDiagnostic) => {
    emit(log, diagnostic);
    diagnostics.push(diagnostic);
  };

  /** Static data serving legitimately: unconfigured, or a database with nothing in it. */
  const bootstrap = (reason: CatalogueSourceReason, diagnostic: CatalogueDiagnostic) => {
    record(diagnostic);
    return bootstrapSnapshot(reason, diagnostics);
  };

  /** Static data serving because the database could not be reached or read. */
  const degraded = (reason: CatalogueSourceReason, diagnostic: CatalogueDiagnostic) => {
    record(diagnostic);
    return degradedSnapshot(reason, diagnostics);
  };

  // `isConfigured()` reads the environment and, for a custom adapter, may do
  // arbitrary work. It sits inside the error boundary so `getCatalogue()` keeps
  // its promise never to reject.
  let configured: boolean;
  try {
    configured = adapter.isConfigured();
  } catch (error) {
    cooldowns.set(adapter, now() + cooldownMs);
    return degraded("configuration_check_failed", {
      code: "configuration_check_failed",
      message: `Database configuration check failed (${causeNameOf(error)}); serving the static catalogue`,
    });
  }

  if (!configured) {
    return bootstrap("database_not_configured", {
      code: "database_not_configured",
      message: "Database is not configured; serving the static catalogue",
    });
  }

  if (now() < (cooldowns.get(adapter) ?? 0)) {
    return degraded("database_unavailable", {
      code: "database_unavailable",
      message: "Database is in a failure cooldown; serving the static catalogue",
    });
  }

  let result;
  try {
    result = await adapter.loadPublishedCatalogue();
  } catch (error) {
    const kind = error instanceof CatalogueDatabaseError ? error.kind : "query_failed";
    // Only the classification and the error's constructor name are recorded —
    // driver messages routinely embed the connection string.
    const causeName = error instanceof CatalogueDatabaseError ? error.causeName : causeNameOf(error);
    if (kind === "unavailable") cooldowns.set(adapter, now() + cooldownMs);
    return degraded(kind === "unavailable" ? "database_unavailable" : "query_failed", {
      code: kind === "unavailable" ? "database_unavailable" : "query_failed",
      message:
        kind === "unavailable"
          ? `Database is unavailable (${causeName}); serving the static catalogue`
          : `Catalogue query failed (${causeName}); serving the static catalogue`,
    });
  }

  if (result.products.length === 0) {
    // A database with no rows at all has never been seeded — bootstrapping from
    // static data is the useful behaviour. A database that holds products but
    // publishes none has been told to show nothing, and that instruction is
    // authoritative: restoring 30 historical products would override an
    // administrator's deliberate decision.
    if ((result.totalProductCount ?? 0) === 0) {
      return bootstrap("database_empty", {
        code: "database_empty",
        message: "Database holds no products; serving the static catalogue as bootstrap",
      });
    }
    record({
      code: "no_published_products",
      message: "Database holds products but none are published; serving an empty catalogue",
    });
    return databaseSnapshot("no_published_products", [], diagnostics);
  }

  const mapped = mapDatabaseCatalogue(result);
  for (const diagnostic of mapped.diagnostics) emit(log, diagnostic);
  diagnostics.push(...mapped.diagnostics);

  if (mapped.products.length === 0) {
    // A data-quality failure, not permission to republish the historical
    // catalogue. The database is still the authority; it currently has nothing
    // usable to say.
    record({
      code: "all_products_invalid",
      message: `All ${result.products.length} published product(s) failed integrity validation; serving an empty catalogue`,
    });
    return databaseSnapshot("all_products_invalid", [], diagnostics);
  }

  return databaseSnapshot("database", mapped.products, diagnostics);
}

// ─── Selectors ────────────────────────────────────────────────────────────
//
// Thin projections over one snapshot. Route-specific filtering lives here, not
// in extra query paths, so M2 caches a single load rather than one per route.

export async function listProducts(
  options: CatalogueRepositoryOptions = {},
): Promise<CatalogueProduct[]> {
  return (await getCatalogue(options)).products;
}

/** Resolves canonical slugs, then legacy slugs, then exact models. */
export async function getProduct(
  slug: string,
  options: CatalogueRepositoryOptions = {},
): Promise<CatalogueProduct | undefined> {
  const snapshot = await getCatalogue(options);
  const direct = snapshot.bySlug.get(slug);
  if (direct) return direct;
  return snapshot.products.find((product) => product.model === slug);
}

export async function listProductsByCategory(
  categorySlug: string,
  options: CatalogueRepositoryOptions = {},
): Promise<CatalogueProduct[]> {
  const snapshot = await getCatalogue(options);
  return snapshot.products.filter((product) => product.categorySlug === categorySlug);
}

export async function listProductsByBrand(
  brandSlug: string,
  options: CatalogueRepositoryOptions = {},
): Promise<CatalogueProduct[]> {
  const snapshot = await getCatalogue(options);
  return snapshot.products.filter((product) => product.brandSlug === brandSlug);
}

function taxonomy(
  products: readonly CatalogueProduct[],
  pick: (product: CatalogueProduct) => { slug: string; name: string },
): CatalogueTaxonomyEntry[] {
  const entries = new Map<string, CatalogueTaxonomyEntry>();
  for (const product of products) {
    const { slug, name } = pick(product);
    const existing = entries.get(slug);
    if (existing) existing.productCount += 1;
    else entries.set(slug, { slug, name, productCount: 1 });
  }
  return [...entries.values()];
}

export async function listCategories(
  options: CatalogueRepositoryOptions = {},
): Promise<CatalogueTaxonomyEntry[]> {
  const snapshot = await getCatalogue(options);
  return taxonomy(snapshot.products, (product) => ({
    slug: product.categorySlug,
    name: product.category,
  }));
}

export async function listBrands(
  options: CatalogueRepositoryOptions = {},
): Promise<CatalogueTaxonomyEntry[]> {
  const snapshot = await getCatalogue(options);
  return taxonomy(snapshot.products, (product) => ({
    slug: product.brandSlug,
    name: product.brand,
  }));
}
