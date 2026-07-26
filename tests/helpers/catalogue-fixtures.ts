/**
 * Typed catalogue fixtures and fake adapters (M1).
 *
 * Every repository behaviour — mapping, ordering, validation, fallback,
 * enrichment, relation repair, logging — is exercised through these, so the
 * suite runs with no PostgreSQL and no TEST_DATABASE_URL.
 */

import type {
  CatalogueCompatibilityRow,
  CatalogueDatabaseAdapter,
  CatalogueDocumentRow,
  CatalogueHighlightRow,
  CatalogueImageRow,
  CatalogueInventoryRow,
  CatalogueLogger,
  CatalogueProductRow,
  CatalogueQueryResult,
  CatalogueSpecRow_Db,
} from "@/data/catalogue-types";

export const FIXTURE_VERIFIED_AT = new Date("2026-07-22T00:00:00.000Z");

let sequence = 0;
function nextId(prefix: string): string {
  sequence += 1;
  return `${prefix}-${String(sequence).padStart(4, "0")}`;
}

export function resetFixtureSequence(): void {
  sequence = 0;
}

// ─── Row builders ─────────────────────────────────────────────────────────

export function productRow(overrides: Partial<CatalogueProductRow> = {}): CatalogueProductRow {
  const slug = overrides.slug ?? nextId("fixture-product");
  return {
    id: overrides.id ?? nextId("uuid"),
    slug,
    legacySlugs: [],
    model: slug.toUpperCase(),
    title: `Fixture ${slug}`,
    shortDescription: "Fixture short description.",
    longDescription: "Fixture long description.",
    brandName: "CP Plus",
    brandSlug: "cp-plus",
    categoryName: "Dome cameras",
    categorySlug: "dome-cameras",
    status: "published",
    stockStatus: "in_stock",
    leadTime: null,
    sellingPriceInclGstPaise: 249_900,
    mrpInclGstPaise: 299_900,
    compareAtPriceInclGstPaise: null,
    compareAtLabel: null,
    gstRateBasisPoints: 1800,
    gstIncluded: true,
    priceSourceStatus: "verified",
    priceVerifiedAt: FIXTURE_VERIFIED_AT,
    warrantySummary: "2-year OEM warranty",
    officialSourceUrl: "https://cpplusworld.com/fixture",
    verifiedAt: FIXTURE_VERIFIED_AT,
    ...overrides,
  };
}

export function imageRow(
  productId: string,
  overrides: Partial<CatalogueImageRow> = {},
): CatalogueImageRow {
  return {
    productId,
    url: `/images/products/${nextId("image")}.webp`,
    alt: "Fixture image",
    position: 0,
    ...overrides,
  };
}

export function documentRow(
  productId: string,
  overrides: Partial<CatalogueDocumentRow> = {},
): CatalogueDocumentRow {
  return {
    id: nextId("doc"),
    productId,
    type: "datasheet",
    title: "Datasheet",
    url: `/docs/datasheets/${nextId("file")}.pdf`,
    modelVerified: true,
    ...overrides,
  };
}

export function specRow(
  productId: string,
  overrides: Partial<CatalogueSpecRow_Db> = {},
): CatalogueSpecRow_Db {
  return {
    productId,
    groupName: "General",
    label: "Fixture label",
    value: "Fixture value",
    position: 0,
    ...overrides,
  };
}

export function highlightRow(
  productId: string,
  overrides: Partial<CatalogueHighlightRow> = {},
): CatalogueHighlightRow {
  return { productId, text: "Fixture highlight", position: 0, ...overrides };
}

export function compatibilityRow(
  productId: string,
  overrides: Partial<CatalogueCompatibilityRow> = {},
): CatalogueCompatibilityRow {
  return { productId, compatibleProductId: null, note: null, ...overrides };
}

export function inventoryRow(
  productId: string,
  overrides: Partial<CatalogueInventoryRow> = {},
): CatalogueInventoryRow {
  return { productId, quantityAvailable: 10, reserved: 0, leadTime: null, ...overrides };
}

export function queryResult(partial: Partial<CatalogueQueryResult> = {}): CatalogueQueryResult {
  return {
    products: [],
    images: [],
    documents: [],
    specs: [],
    highlights: [],
    compatibility: [],
    inventory: [],
    ...partial,
  };
}

// ─── Fake adapter ─────────────────────────────────────────────────────────

export type FakeAdapter = CatalogueDatabaseAdapter & {
  /** How many times the repository asked the database for the catalogue. */
  calls: number;
};

export function fakeAdapter(options: {
  configured?: boolean;
  result?: CatalogueQueryResult;
  error?: unknown;
  /** Called instead of returning `result`, for per-call behaviour. */
  onLoad?: (call: number) => CatalogueQueryResult;
}): FakeAdapter {
  const adapter: FakeAdapter = {
    calls: 0,
    isConfigured: () => options.configured ?? true,
    async loadPublishedCatalogue() {
      adapter.calls += 1;
      if (options.error) throw options.error;
      if (options.onLoad) return options.onLoad(adapter.calls);
      return options.result ?? queryResult();
    },
  };
  return adapter;
}

// ─── Recording logger ─────────────────────────────────────────────────────

export type LogEntry = {
  level: "debug" | "warn" | "error";
  payload: Record<string, unknown>;
  message: string;
};

export type RecordingLogger = CatalogueLogger & { entries: LogEntry[] };

export function recordingLogger(): RecordingLogger {
  const entries: LogEntry[] = [];
  return {
    entries,
    debug: (payload, message) => entries.push({ level: "debug", payload, message }),
    warn: (payload, message) => entries.push({ level: "warn", payload, message }),
    error: (payload, message) => entries.push({ level: "error", payload, message }),
  };
}

/** Every string a logger emitted, for secret-leakage assertions. */
export function loggedText(logger: RecordingLogger): string {
  return logger.entries.map((entry) => `${entry.message} ${JSON.stringify(entry.payload)}`).join(" ");
}
