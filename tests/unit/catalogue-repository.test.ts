/**
 * Catalogue repository — deterministic suite (M1).
 *
 * Runs entirely on injected adapters and typed fixtures. No PostgreSQL, no
 * TEST_DATABASE_URL, no network. The optional real-database suite lives in
 * `tests/integration/catalogue-repository.test.ts`.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { catalogue } from "@/data/catalog";
import { CatalogueDatabaseError } from "@/data/catalogue-db-adapter";
import { PLACEHOLDER_IMAGE_URL } from "@/data/catalogue-static";
import type { CatalogueProduct } from "@/data/catalogue-types";
import {
  getCatalogue,
  getProduct,
  listBrands,
  listCategories,
  listProducts,
  listProductsByBrand,
  listProductsByCategory,
  resetCatalogueRepositoryState,
} from "@/data/repository";
import { getPurchaseEligibility } from "@/lib/products";
import {
  compatibilityRow,
  documentRow,
  fakeAdapter,
  highlightRow,
  imageRow,
  inventoryRow,
  loggedText,
  productRow,
  queryResult,
  recordingLogger,
  specRow,
} from "@tests/helpers/catalogue-fixtures";

const STATIC_PRODUCT_COUNT = 30;

/** A real static entry, used to exercise slug-matched enrichment. */
const enrichedStatic = catalogue.find(
  (product) => product.useCases.length > 0 && product.builderCompatibleIds.length > 0,
)!;

/** A real static entry that carries related-product references. */
const relatedStatic = catalogue.find((product) => product.relatedProductIds.length > 0)!;

/** A second, distinct static entry, for precedence assertions. */
const otherStatic = catalogue.find(
  (product) => product.slug !== enrichedStatic.slug && product.useCases.length > 0,
)!;

beforeEach(() => {
  resetCatalogueRepositoryState();
});

// ─── 1–5, 8: fallback paths ───────────────────────────────────────────────

describe("source selection — fallback", () => {
  it("returns the complete static catalogue when the database is not configured", async () => {
    const adapter = fakeAdapter({ configured: false });
    const snapshot = await getCatalogue({ adapter, logger: recordingLogger() });

    expect(snapshot.source).toBe("static");
    expect(snapshot.reason).toBe("database_not_configured");
    expect(snapshot.products).toHaveLength(STATIC_PRODUCT_COUNT);
    expect(adapter.calls).toBe(0);
  });

  it("returns the complete static catalogue when database initialisation fails", async () => {
    const adapter = fakeAdapter({
      error: new CatalogueDatabaseError("unavailable", "NeonDbError"),
    });
    const snapshot = await getCatalogue({ adapter, logger: recordingLogger() });

    expect(snapshot.source).toBe("static");
    expect(snapshot.reason).toBe("database_unavailable");
    expect(snapshot.products).toHaveLength(STATIC_PRODUCT_COUNT);
  });

  it("returns the complete static catalogue when the catalogue query fails", async () => {
    const adapter = fakeAdapter({
      error: new CatalogueDatabaseError("query_failed", "NeonDbError"),
    });
    const snapshot = await getCatalogue({ adapter, logger: recordingLogger() });

    expect(snapshot.source).toBe("static");
    expect(snapshot.reason).toBe("query_failed");
    expect(snapshot.products).toHaveLength(STATIC_PRODUCT_COUNT);
  });

  it("returns the complete static catalogue when the database is configured but empty", async () => {
    const adapter = fakeAdapter({ result: queryResult({ totalProductCount: 0 }) });
    const snapshot = await getCatalogue({ adapter, logger: recordingLogger() });

    expect(snapshot.source).toBe("static");
    expect(snapshot.reason).toBe("database_empty");
    expect(snapshot.products).toHaveLength(STATIC_PRODUCT_COUNT);
  });

  it("returns the complete static catalogue when no products are published", async () => {
    const adapter = fakeAdapter({ result: queryResult({ totalProductCount: 12 }) });
    const snapshot = await getCatalogue({ adapter, logger: recordingLogger() });

    expect(snapshot.source).toBe("static");
    expect(snapshot.reason).toBe("no_published_products");
    expect(snapshot.products).toHaveLength(STATIC_PRODUCT_COUNT);
  });

  it("returns the static catalogue when every published product is unusable", async () => {
    const adapter = fakeAdapter({
      result: queryResult({
        products: [productRow({ slug: "" }), productRow({ model: "  " })],
      }),
    });
    const logger = recordingLogger();
    const snapshot = await getCatalogue({ adapter, logger });

    expect(snapshot.source).toBe("static");
    expect(snapshot.reason).toBe("all_products_invalid");
    expect(snapshot.products).toHaveLength(STATIC_PRODUCT_COUNT);
    expect(logger.entries.some((entry) => entry.payload.code === "all_products_invalid")).toBe(true);
  });

  it("never renders an empty catalogue for any failure mode", async () => {
    const adapters = [
      fakeAdapter({ configured: false }),
      fakeAdapter({ error: new CatalogueDatabaseError("unavailable", "Error") }),
      fakeAdapter({ error: new CatalogueDatabaseError("query_failed", "Error") }),
      fakeAdapter({ result: queryResult({ totalProductCount: 0 }) }),
      fakeAdapter({ result: queryResult({ totalProductCount: 5 }) }),
    ];
    for (const adapter of adapters) {
      resetCatalogueRepositoryState();
      const snapshot = await getCatalogue({ adapter, logger: recordingLogger() });
      expect(snapshot.products.length).toBeGreaterThan(0);
    }
  });
});

// ─── 6, 7: database preference ────────────────────────────────────────────

describe("source selection — database", () => {
  it("prefers a valid database catalogue over the static fallback", async () => {
    const row = productRow({ slug: "db-only-product", title: "Database title" });
    const adapter = fakeAdapter({ result: queryResult({ products: [row] }) });
    const snapshot = await getCatalogue({ adapter, logger: recordingLogger() });

    expect(snapshot.source).toBe("database");
    expect(snapshot.reason).toBe("database");
    expect(snapshot.products).toHaveLength(1);
    expect(snapshot.products[0].title).toBe("Database title");
    expect(snapshot.products[0].source).toBe("database");
  });

  it("keeps valid database products when part of the catalogue is malformed", async () => {
    const valid = productRow({ slug: "valid-product" });
    const adapter = fakeAdapter({
      result: queryResult({
        products: [
          valid,
          productRow({ slug: "broken-brand", brandSlug: "" }),
          productRow({ slug: "broken-gst", gstIncluded: false }),
        ],
      }),
    });
    const logger = recordingLogger();
    const snapshot = await getCatalogue({ adapter, logger });

    expect(snapshot.source).toBe("database");
    expect(snapshot.products.map((product) => product.slug)).toEqual(["valid-product"]);
    expect(
      snapshot.diagnostics.filter((diagnostic) => diagnostic.code === "product_excluded"),
    ).toHaveLength(2);
    expect(logger.entries.some((entry) => entry.payload.code === "product_excluded")).toBe(true);
  });
});

// ─── 9, 10, 32: static fallback contract ──────────────────────────────────

describe("static fallback contract", () => {
  it("contains all 30 expected products with unique identities", async () => {
    const products = await listProducts({
      adapter: fakeAdapter({ configured: false }),
      logger: recordingLogger(),
    });

    expect(products).toHaveLength(STATIC_PRODUCT_COUNT);
    expect(new Set(products.map((product) => product.id)).size).toBe(STATIC_PRODUCT_COUNT);
    expect(new Set(products.map((product) => product.slug)).size).toBe(STATIC_PRODUCT_COUNT);
  });

  it("satisfies the full public product contract", async () => {
    const products = await listProducts({
      adapter: fakeAdapter({ configured: false }),
      logger: recordingLogger(),
    });

    for (const product of products) {
      expect(typeof product.id).toBe("string");
      expect(product.id.length).toBeGreaterThan(0);
      expect(typeof product.model).toBe("string");
      expect(typeof product.title).toBe("string");
      expect(typeof product.shortDescription).toBe("string");
      expect(typeof product.longDescription).toBe("string");
      expect(typeof product.brand).toBe("string");
      expect(typeof product.brandSlug).toBe("string");
      expect(typeof product.category).toBe("string");
      expect(typeof product.categorySlug).toBe("string");
      expect(Array.isArray(product.legacySlugs)).toBe(true);
      expect(Array.isArray(product.images)).toBe(true);
      expect(product.images.length).toBeGreaterThan(0);
      expect(Array.isArray(product.documents)).toBe(true);
      expect(Array.isArray(product.highlights)).toBe(true);
      expect(Array.isArray(product.useCases)).toBe(true);
      expect(Array.isArray(product.relatedProductIds)).toBe(true);
      expect(Array.isArray(product.builderCompatibleIds)).toBe(true);
      expect(Array.isArray(product.builderExclusions)).toBe(true);
      expect(typeof product.specs).toBe("object");
      expect(product.gstIncluded).toBe(true);
      expect(Number.isSafeInteger(product.gstRateBasisPoints)).toBe(true);
      expect(["in_stock", "limited", "lead_time", "quote_only"]).toContain(product.stockStatus);
      expect(["verified", "needs-review", "request-price"]).toContain(product.priceSourceStatus);
      expect(typeof product.verifiedAt).toBe("string");
      expect(typeof product.warrantySummary).toBe("string");
      // Repository additions
      expect(product.source).toBe("static");
      expect(product.databaseId).toBeNull();
      expect(Array.isArray(product.specGroups)).toBe(true);
      expect(Array.isArray(product.imageDetails)).toBe(true);
      expect(Array.isArray(product.documentDetails)).toBe(true);
      expect(typeof product.searchText).toBe("string");
      // Purchase eligibility must still be computable — M1 changes no policy.
      expect(() => getPurchaseEligibility(product)).not.toThrow();
    }
  });

  it("keeps the static id ↔ slug invariant intact in both modes", async () => {
    const staticProducts = await listProducts({
      adapter: fakeAdapter({ configured: false }),
      logger: recordingLogger(),
    });
    for (const product of staticProducts) expect(product.id).toBe(product.slug);

    const row = productRow({ id: "uuid-1234", slug: "invariant-product" });
    const dbProducts = await listProducts({
      adapter: fakeAdapter({ result: queryResult({ products: [row] }) }),
      logger: recordingLogger(),
    });

    // The cart stores `id` and checkout resolves it as `products.slug`, so the
    // public id must be the slug — never the database uuid.
    expect(dbProducts[0].id).toBe("invariant-product");
    expect(dbProducts[0].id).toBe(dbProducts[0].slug);
    expect(dbProducts[0].databaseId).toBe("uuid-1234");
    expect(dbProducts[0].id).not.toBe(dbProducts[0].databaseId);
  });
});

// ─── 11–15: ordering and structure ────────────────────────────────────────

describe("mapping preserves order and structure", () => {
  async function mapOne(
    overrides: Parameters<typeof productRow>[0],
    build: (id: string) => Partial<Parameters<typeof queryResult>[0]>,
  ): Promise<CatalogueProduct> {
    const row = productRow(overrides);
    const snapshot = await getCatalogue({
      adapter: fakeAdapter({ result: queryResult({ products: [row], ...build(row.id) }) }),
      logger: recordingLogger(),
    });
    expect(snapshot.source).toBe("database");
    return snapshot.products[0];
  }

  it("preserves image order and primary semantics from unordered rows", async () => {
    const product = await mapOne({ slug: "image-order" }, (id) => ({
      images: [
        imageRow(id, { url: "/images/products/third.webp", position: 2, alt: "Third" }),
        imageRow(id, { url: "/images/products/first.webp", position: 0, alt: "First" }),
        imageRow(id, { url: "/images/products/second.webp", position: 1, alt: "Second" }),
      ],
    }));

    expect(product.images).toEqual([
      "/images/products/first.webp",
      "/images/products/second.webp",
      "/images/products/third.webp",
    ]);
    expect(product.imageDetails.map((image) => image.alt)).toEqual(["First", "Second", "Third"]);
    expect(product.imageDetails[0].isPrimary).toBe(true);
    expect(product.imageDetails.slice(1).every((image) => !image.isPrimary)).toBe(true);
  });

  it("preserves document order and verification state", async () => {
    const product = await mapOne({ slug: "document-order" }, (id) => ({
      documents: [
        documentRow(id, { id: "d3", type: "manual", title: "User manual" }),
        documentRow(id, { id: "d1", type: "datasheet", title: "Datasheet" }),
        documentRow(id, {
          id: "d2",
          type: "installation-guide",
          title: "Unverified guide",
          modelVerified: false,
        }),
      ],
    }));

    // Ordered by type, then title, then id — `product_documents` has no position column.
    expect(product.documentDetails.map((document) => document.type)).toEqual([
      "datasheet",
      "installation-guide",
      "manual",
    ]);
    expect(product.documentDetails.map((document) => document.modelVerified)).toEqual([
      true,
      false,
      true,
    ]);
    // Only verified documents reach the public array, in the same order.
    expect(product.documents.map((document) => document.title)).toEqual([
      "Datasheet",
      "User manual",
    ]);
    expect(product.documents.every((document) => document.model === product.model)).toBe(true);
  });

  it("preserves specification group names and group order", async () => {
    const product = await mapOne({ slug: "spec-groups" }, (id) => ({
      specs: [
        specRow(id, { groupName: "Power", label: "Input", value: "12 V DC", position: 10 }),
        specRow(id, { groupName: "Imaging", label: "Sensor", value: "1/3\"", position: 0 }),
        specRow(id, { groupName: "Power", label: "Consumption", value: "6 W", position: 11 }),
        specRow(id, { groupName: null, label: "Weight", value: "410 g", position: 20 }),
      ],
    }));

    expect(product.specGroups.map((group) => group.name)).toEqual(["Imaging", "Power", "General"]);
    expect(product.specGroups.map((group) => group.position)).toEqual([0, 1, 2]);
    expect(product.specGroups[1].rows.map((row) => row.label)).toEqual(["Input", "Consumption"]);
    // Groups are not flattened away — the flat record remains available too.
    expect(product.specs).toEqual({
      Sensor: '1/3"',
      Input: "12 V DC",
      Consumption: "6 W",
      Weight: "410 g",
    });
  });

  it("preserves specification row order and breaks duplicate positions deterministically", async () => {
    const product = await mapOne({ slug: "spec-rows" }, (id) => ({
      specs: [
        specRow(id, { label: "Zebra", value: "z", position: 5 }),
        specRow(id, { label: "Alpha", value: "a", position: 5 }),
        specRow(id, { label: "First", value: "1", position: 1 }),
      ],
    }));

    expect(product.specGroups[0].rows.map((row) => row.label)).toEqual(["First", "Alpha", "Zebra"]);
  });

  it("preserves highlight order", async () => {
    const product = await mapOne({ slug: "highlight-order" }, (id) => ({
      highlights: [
        highlightRow(id, { text: "Third highlight", position: 2 }),
        highlightRow(id, { text: "First highlight", position: 0 }),
        highlightRow(id, { text: "Second highlight", position: 1 }),
      ],
    }));

    expect(product.highlights).toEqual([
      "First highlight",
      "Second highlight",
      "Third highlight",
    ]);
  });

  it("derives inventory figures without altering stock status", async () => {
    const product = await mapOne({ slug: "inventory-derived", stockStatus: "limited" }, (id) => ({
      inventory: [inventoryRow(id, { quantityAvailable: 9, reserved: 4, leadTime: "3 days" })],
    }));

    expect(product.inventory).toEqual({
      onHandUnits: 9,
      reservedUnits: 4,
      availableUnits: 5,
      leadTime: "3 days",
    });
    expect(product.stockStatus).toBe("limited");
  });
});

// ─── 16–18: field authority ───────────────────────────────────────────────

describe("field authority", () => {
  it("lets database values override static enrichment for schema-backed fields", async () => {
    const row = productRow({
      slug: enrichedStatic.slug,
      title: "Database wins",
      shortDescription: "Database description",
      sellingPriceInclGstPaise: 111_100,
      stockStatus: "quote_only",
      priceSourceStatus: "request_price",
      brandName: "Database brand",
      brandSlug: "database-brand",
    });
    const snapshot = await getCatalogue({
      adapter: fakeAdapter({
        result: queryResult({
          products: [row],
          images: [imageRow(row.id, { url: "/images/products/db.webp", position: 0 })],
          highlights: [highlightRow(row.id, { text: "Database highlight" })],
        }),
      }),
      logger: recordingLogger(),
    });
    const product = snapshot.products[0];

    expect(product.title).toBe("Database wins");
    expect(product.shortDescription).toBe("Database description");
    expect(product.sellingPriceInclGstPaise).toBe(111_100);
    expect(product.stockStatus).toBe("quote_only");
    expect(product.brand).toBe("Database brand");
    expect(product.images).toEqual(["/images/products/db.webp"]);
    expect(product.highlights).toEqual(["Database highlight"]);
    // Never the static values for these fields.
    expect(product.title).not.toBe(enrichedStatic.title);
    expect(product.images).not.toEqual(enrichedStatic.images);
    expect(product.enrichedFields).not.toContain("images");
    // Snake_case database enum is normalised to the public kebab-case contract.
    expect(product.priceSourceStatus).toBe("request-price");
  });

  it("enriches only the fields the schema cannot represent", async () => {
    const row = productRow({ slug: enrichedStatic.slug, title: "Database title" });
    const snapshot = await getCatalogue({
      adapter: fakeAdapter({
        result: queryResult({
          products: [row],
          images: [imageRow(row.id, { url: "/images/products/db.webp" })],
        }),
      }),
      logger: recordingLogger(),
    });
    const product = snapshot.products[0];

    expect(product.useCases).toEqual(enrichedStatic.useCases);
    expect(product.builderExclusions).toEqual(enrichedStatic.builderExclusions);
    expect(product.enrichedFields).toContain("useCases");
    expect(product.enrichedFields).toContain("builderExclusions");
    // Schema-backed fields are not listed as enriched.
    expect(product.enrichedFields).not.toContain("images");
    expect(product.title).toBe("Database title");
  });

  it("uses database compatibility rows in preference to static enrichment", async () => {
    const primary = productRow({ slug: enrichedStatic.slug });
    const partner = productRow({ slug: "compatible-partner" });
    const snapshot = await getCatalogue({
      adapter: fakeAdapter({
        result: queryResult({
          products: [primary, partner],
          compatibility: [
            compatibilityRow(primary.id, { compatibleProductId: partner.id, note: "Tested pair" }),
          ],
        }),
      }),
      logger: recordingLogger(),
    });
    const product = snapshot.products.find((entry) => entry.slug === enrichedStatic.slug)!;

    expect(product.builderCompatibleIds).toEqual(["compatible-partner"]);
    expect(product.enrichedFields).not.toContain("builderCompatibleIds");
    expect(product.compatibility[0].note).toBe("Tested pair");
  });

  it("maps admin-created products with no static counterpart safely", async () => {
    const row = productRow({
      slug: "admin-created-product",
      title: "Admin created",
      legacySlugs: null,
      longDescription: null,
      warrantySummary: null,
    });
    const snapshot = await getCatalogue({
      adapter: fakeAdapter({ result: queryResult({ products: [row] }) }),
      logger: recordingLogger(),
    });
    const product = snapshot.products[0];

    expect(product.slug).toBe("admin-created-product");
    expect(product.useCases).toEqual([]);
    expect(product.relatedProductIds).toEqual([]);
    expect(product.builderCompatibleIds).toEqual([]);
    expect(product.builderExclusions).toEqual([]);
    expect(product.enrichedFields).toEqual([]);
    expect(product.legacySlugs).toEqual([]);
    // Documented safe defaults, not invented content.
    expect(product.longDescription).toBe(product.shortDescription);
    expect(product.warrantySummary).toBe("OEM warranty terms apply");
    expect(product.images).toEqual([PLACEHOLDER_IMAGE_URL]);
  });
});

// ─── 19–23: relation handling ─────────────────────────────────────────────

describe("relation handling", () => {
  it("filters related-product references to products missing from the catalogue", async () => {
    const row = productRow({ slug: relatedStatic.slug });
    const snapshot = await getCatalogue({
      adapter: fakeAdapter({ result: queryResult({ products: [row] }) }),
      logger: recordingLogger(),
    });
    const product = snapshot.products[0];

    expect(relatedStatic.relatedProductIds.length).toBeGreaterThan(0);
    expect(product.relatedProductIds).toEqual([]);
    expect(
      snapshot.diagnostics.some(
        (diagnostic) =>
          diagnostic.code === "relation_discarded" && diagnostic.productId === relatedStatic.slug,
      ),
    ).toBe(true);
  });

  it("filters builder-compatible references to products missing from the catalogue", async () => {
    const primary = productRow({ slug: "builder-primary" });
    const partner = productRow({ slug: "builder-partner" });
    const snapshot = await getCatalogue({
      adapter: fakeAdapter({
        result: queryResult({
          products: [primary, partner],
          compatibility: [
            compatibilityRow(primary.id, { compatibleProductId: partner.id }),
            compatibilityRow(primary.id, { compatibleProductId: "uuid-not-published" }),
          ],
        }),
      }),
      logger: recordingLogger(),
    });
    const product = snapshot.products.find((entry) => entry.slug === "builder-primary")!;

    expect(product.builderCompatibleIds).toEqual(["builder-partner"]);
  });

  it("deduplicates relationships deterministically, keeping first valid order", async () => {
    const primary = productRow({ slug: "dedupe-primary" });
    const alpha = productRow({ slug: "alpha-partner" });
    const beta = productRow({ slug: "beta-partner" });
    const snapshot = await getCatalogue({
      adapter: fakeAdapter({
        result: queryResult({
          products: [primary, alpha, beta],
          compatibility: [
            compatibilityRow(primary.id, { compatibleProductId: alpha.id }),
            compatibilityRow(primary.id, { compatibleProductId: beta.id }),
            compatibilityRow(primary.id, { compatibleProductId: alpha.id }),
          ],
        }),
      }),
      logger: recordingLogger(),
    });
    const product = snapshot.products.find((entry) => entry.slug === "dedupe-primary")!;

    expect(product.builderCompatibleIds).toEqual(["alpha-partner", "beta-partner"]);
  });

  it("removes self-references", async () => {
    const primary = productRow({ slug: "self-referencing" });
    const partner = productRow({ slug: "other-product" });
    const snapshot = await getCatalogue({
      adapter: fakeAdapter({
        result: queryResult({
          products: [primary, partner],
          compatibility: [
            compatibilityRow(primary.id, { compatibleProductId: primary.id }),
            compatibilityRow(primary.id, { compatibleProductId: partner.id }),
          ],
        }),
      }),
      logger: recordingLogger(),
    });
    const product = snapshot.products.find((entry) => entry.slug === "self-referencing")!;

    expect(product.builderCompatibleIds).toEqual(["other-product"]);
    expect(
      product.compatibility.every((entry) => entry.compatibleProductId !== "self-referencing"),
    ).toBe(true);
  });

  it("keeps the containing product when an optional relation is invalid", async () => {
    const row = productRow({ slug: "resilient-product" });
    const snapshot = await getCatalogue({
      adapter: fakeAdapter({
        result: queryResult({
          products: [row],
          compatibility: [
            compatibilityRow(row.id, { compatibleProductId: "uuid-missing" }),
            compatibilityRow(row.id, { compatibleProductId: null, note: "Note-only row" }),
          ],
          specs: [specRow(row.id, { label: "" })],
          images: [imageRow(row.id, { url: "" })],
          documents: [documentRow(row.id, { title: "" })],
        }),
      }),
      logger: recordingLogger(),
    });

    expect(snapshot.source).toBe("database");
    expect(snapshot.products).toHaveLength(1);
    expect(snapshot.products[0].slug).toBe("resilient-product");
    expect(snapshot.products[0].specGroups).toEqual([]);
    expect(snapshot.products[0].documents).toEqual([]);
  });
});

// ─── 24–26: integrity ─────────────────────────────────────────────────────

describe("product integrity", () => {
  it("excludes only the product whose required identity fields are invalid", async () => {
    const adapter = fakeAdapter({
      result: queryResult({
        products: [
          productRow({ slug: "keeps-working" }),
          productRow({ slug: "no-model", model: "" }),
          productRow({ slug: "no-title", title: "   " }),
          productRow({ slug: "bad-stock", stockStatus: "teleported" }),
          productRow({ slug: "bad-price-status", priceSourceStatus: "unknown_state" }),
          productRow({ slug: "no-category", categorySlug: "" }),
        ],
      }),
    });
    const snapshot = await getCatalogue({ adapter, logger: recordingLogger() });

    expect(snapshot.source).toBe("database");
    expect(snapshot.products.map((product) => product.slug)).toEqual(["keeps-working"]);
    expect(
      snapshot.diagnostics.filter((diagnostic) => diagnostic.code === "product_excluded"),
    ).toHaveLength(5);
  });

  it("keeps a missing or invalid price explicit and never fabricates one", async () => {
    const snapshot = await getCatalogue({
      adapter: fakeAdapter({
        result: queryResult({
          products: [
            productRow({ slug: "no-price", sellingPriceInclGstPaise: null }),
            productRow({ slug: "negative-price", sellingPriceInclGstPaise: -4900 }),
            productRow({ slug: "fractional-price", sellingPriceInclGstPaise: 1299.5 }),
          ],
        }),
      }),
      logger: recordingLogger(),
    });

    for (const product of snapshot.products) {
      expect(product.sellingPriceInclGstPaise).toBeNull();
      expect(getPurchaseEligibility(product).eligible).toBe(false);
    }
    expect(snapshot.products).toHaveLength(3);
    expect(
      snapshot.diagnostics.filter((diagnostic) => diagnostic.code === "product_mapping_failed"),
    ).toHaveLength(2);
  });

  it("discards a compare-at pair whose label is unrecognised", async () => {
    const snapshot = await getCatalogue({
      adapter: fakeAdapter({
        result: queryResult({
          products: [
            productRow({
              slug: "bad-compare-label",
              compareAtLabel: "Was ₹9999",
              compareAtPriceInclGstPaise: 999_900,
            }),
          ],
        }),
      }),
      logger: recordingLogger(),
    });
    const product = snapshot.products[0];

    expect(product.compareAtLabel).toBeNull();
    expect(product.compareAtPriceInclGstPaise).toBeNull();
  });

  it("applies a safe image fallback in the documented order", async () => {
    const withStaticCounterpart = productRow({ slug: enrichedStatic.slug });
    const withoutCounterpart = productRow({ slug: "no-images-anywhere" });
    const snapshot = await getCatalogue({
      adapter: fakeAdapter({
        result: queryResult({ products: [withStaticCounterpart, withoutCounterpart] }),
      }),
      logger: recordingLogger(),
    });

    const enriched = snapshot.products.find((entry) => entry.slug === enrichedStatic.slug)!;
    const placeholder = snapshot.products.find((entry) => entry.slug === "no-images-anywhere")!;

    expect(enriched.images).toEqual(enrichedStatic.images);
    expect(enriched.enrichedFields).toContain("images");
    expect(placeholder.images).toEqual([PLACEHOLDER_IMAGE_URL]);
    expect(placeholder.imageDetails[0].isPrimary).toBe(true);
  });
});

// ─── 27: logging safety ───────────────────────────────────────────────────

describe("error and logging policy", () => {
  const SECRET = "postgresql://catalogue_user:sup3r-s3cret@db.example.neon.tech/main?sslmode=require";

  it("never exposes connection details when the database is unavailable", async () => {
    const driverError = new Error(`connect ECONNREFUSED for ${SECRET}`);
    driverError.name = "NeonDbError";
    const logger = recordingLogger();
    const snapshot = await getCatalogue({
      adapter: fakeAdapter({ error: new CatalogueDatabaseError("unavailable", driverError.name) }),
      logger,
    });

    const text = `${loggedText(logger)} ${JSON.stringify(snapshot.diagnostics)}`;
    expect(text).not.toContain(SECRET);
    expect(text).not.toContain("sup3r-s3cret");
    expect(text).not.toContain("db.example.neon.tech");
    expect(text).toContain("NeonDbError");
  });

  it("never propagates a raw driver error to the caller", async () => {
    const raw = new Error(`SELECT failed against ${SECRET}`);
    const logger = recordingLogger();
    const snapshot = await getCatalogue({ adapter: fakeAdapter({ error: raw }), logger });

    expect(snapshot.source).toBe("static");
    expect(snapshot.reason).toBe("query_failed");
    const text = `${loggedText(logger)} ${JSON.stringify(snapshot.diagnostics)}`;
    expect(text).not.toContain(SECRET);
    expect(text).not.toContain("sup3r-s3cret");
  });

  it("distinguishes every failure mode in its diagnostics", async () => {
    const cases: Array<[ReturnType<typeof fakeAdapter>, string]> = [
      [fakeAdapter({ configured: false }), "database_not_configured"],
      [fakeAdapter({ error: new CatalogueDatabaseError("unavailable", "E") }), "database_unavailable"],
      [fakeAdapter({ error: new CatalogueDatabaseError("query_failed", "E") }), "query_failed"],
      [fakeAdapter({ result: queryResult({ totalProductCount: 0 }) }), "database_empty"],
      [fakeAdapter({ result: queryResult({ totalProductCount: 3 }) }), "no_published_products"],
    ];

    for (const [adapter, code] of cases) {
      resetCatalogueRepositoryState();
      const logger = recordingLogger();
      const snapshot = await getCatalogue({ adapter, logger });
      expect(snapshot.diagnostics.some((diagnostic) => diagnostic.code === code)).toBe(true);
      expect(logger.entries.some((entry) => entry.payload.code === code)).toBe(true);
    }
  });
});

// ─── 28: bounded database access ──────────────────────────────────────────

describe("query efficiency", () => {
  it("asks the database once per catalogue load, whatever the catalogue size", async () => {
    const products = Array.from({ length: 200 }, (_, index) =>
      productRow({ slug: `bulk-product-${index}` }),
    );
    const rows = queryResult({
      products,
      images: products.flatMap((product) => [
        imageRow(product.id, { position: 1 }),
        imageRow(product.id, { position: 0 }),
      ]),
      specs: products.map((product) => specRow(product.id)),
      highlights: products.map((product) => highlightRow(product.id)),
    });
    const adapter = fakeAdapter({ result: rows });

    const snapshot = await getCatalogue({ adapter, logger: recordingLogger() });
    expect(snapshot.products).toHaveLength(200);
    expect(adapter.calls).toBe(1);
  });

  it("does not issue extra loads for lookups or filters", async () => {
    const row = productRow({ slug: "single-load" });
    const adapter = fakeAdapter({ result: queryResult({ products: [row] }) });
    const options = { adapter, logger: recordingLogger() };

    await getProduct("single-load", options);
    expect(adapter.calls).toBe(1);
    await listProductsByCategory("dome-cameras", options);
    expect(adapter.calls).toBe(2);
    await listProductsByBrand("cp-plus", options);
    expect(adapter.calls).toBe(3);
  });

  it("stops re-dialling a database that failed to connect, then retries after the cooldown", async () => {
    let clock = 1_000;
    const adapter = fakeAdapter({ error: new CatalogueDatabaseError("unavailable", "NeonDbError") });
    const options = {
      adapter,
      logger: recordingLogger(),
      now: () => clock,
      failureCooldownMs: 30_000,
    };

    await getCatalogue(options);
    expect(adapter.calls).toBe(1);

    await getCatalogue(options);
    await getCatalogue(options);
    expect(adapter.calls).toBe(1);

    clock += 30_001;
    await getCatalogue(options);
    expect(adapter.calls).toBe(2);
  });

  it("retries after a query failure, which may be transient", async () => {
    const adapter = fakeAdapter({ error: new CatalogueDatabaseError("query_failed", "NeonDbError") });
    const options = { adapter, logger: recordingLogger() };

    await getCatalogue(options);
    await getCatalogue(options);
    expect(adapter.calls).toBe(2);
  });
});

// ─── 29, 30: consistent selectors across both modes ───────────────────────

describe("selectors behave consistently in both modes", () => {
  const staticOptions = { adapter: fakeAdapter({ configured: false }), logger: recordingLogger() };

  it("looks up a product by canonical slug, legacy slug and model", async () => {
    const staticWithLegacy = catalogue.find((product) => product.legacySlugs.length > 0)!;

    const byCanonical = await getProduct(staticWithLegacy.slug, staticOptions);
    const byLegacy = await getProduct(staticWithLegacy.legacySlugs[0], staticOptions);
    const byModel = await getProduct(staticWithLegacy.model, staticOptions);
    const missing = await getProduct("no-such-product", staticOptions);

    expect(byCanonical?.slug).toBe(staticWithLegacy.slug);
    expect(byLegacy?.slug).toBe(staticWithLegacy.slug);
    expect(byModel?.slug).toBe(staticWithLegacy.slug);
    expect(missing).toBeUndefined();

    const row = productRow({ slug: "db-lookup", model: "DB-MODEL-1", legacySlugs: ["old-lookup"] });
    const dbOptions = {
      adapter: fakeAdapter({ result: queryResult({ products: [row] }) }),
      logger: recordingLogger(),
    };

    expect((await getProduct("db-lookup", dbOptions))?.slug).toBe("db-lookup");
    expect((await getProduct("old-lookup", dbOptions))?.slug).toBe("db-lookup");
    expect((await getProduct("DB-MODEL-1", dbOptions))?.slug).toBe("db-lookup");
    expect(await getProduct("no-such-product", dbOptions)).toBeUndefined();
  });

  it("filters by category and brand in both modes", async () => {
    const staticProduct = catalogue[0];
    const staticByCategory = await listProductsByCategory(staticProduct.categorySlug, staticOptions);
    const staticByBrand = await listProductsByBrand(staticProduct.brandSlug, staticOptions);

    expect(staticByCategory.length).toBeGreaterThan(0);
    expect(staticByCategory.every((p) => p.categorySlug === staticProduct.categorySlug)).toBe(true);
    expect(staticByBrand.every((p) => p.brandSlug === staticProduct.brandSlug)).toBe(true);
    expect(await listProductsByCategory("no-such-category", staticOptions)).toEqual([]);

    const dbOptions = {
      adapter: fakeAdapter({
        result: queryResult({
          products: [
            productRow({ slug: "cam-1", categorySlug: "dome-cameras", brandSlug: "cp-plus" }),
            productRow({
              slug: "nvr-1",
              categorySlug: "nvrs",
              categoryName: "NVRs",
              brandSlug: "cp-plus",
            }),
            productRow({
              slug: "bio-1",
              categorySlug: "biometrics",
              categoryName: "Biometrics",
              brandSlug: "essl",
              brandName: "eSSL",
            }),
          ],
        }),
      }),
      logger: recordingLogger(),
    };

    expect((await listProductsByCategory("dome-cameras", dbOptions)).map((p) => p.slug)).toEqual([
      "cam-1",
    ]);
    expect((await listProductsByBrand("cp-plus", dbOptions)).map((p) => p.slug)).toEqual([
      "cam-1",
      "nvr-1",
    ]);
    expect(await listProductsByCategory("no-such-category", dbOptions)).toEqual([]);
  });

  it("derives category and brand taxonomies with counts in both modes", async () => {
    const staticCategories = await listCategories(staticOptions);
    const staticBrands = await listBrands(staticOptions);

    expect(staticCategories.length).toBeGreaterThan(0);
    expect(staticCategories.reduce((sum, entry) => sum + entry.productCount, 0)).toBe(
      STATIC_PRODUCT_COUNT,
    );
    expect(staticBrands.reduce((sum, entry) => sum + entry.productCount, 0)).toBe(
      STATIC_PRODUCT_COUNT,
    );

    const dbOptions = {
      adapter: fakeAdapter({
        result: queryResult({
          products: [
            productRow({ slug: "tax-1", categorySlug: "dome-cameras" }),
            productRow({ slug: "tax-2", categorySlug: "dome-cameras" }),
          ],
        }),
      }),
      logger: recordingLogger(),
    };

    expect(await listCategories(dbOptions)).toEqual([
      { slug: "dome-cameras", name: "Dome cameras", productCount: 2 },
    ]);
  });
});

// ─── M1.1: enrichment resolution end to end ───────────────────────────────
//
// Precedence and ambiguity are covered exhaustively against a synthetic
// catalogue in `catalogue-enrichment-resolution.test.ts`. These assert the
// resolver is wired into the mapper and reaches the real static catalogue.

describe("enrichment resolution through the repository", () => {
  async function loadOne(overrides: Parameters<typeof productRow>[0]) {
    const snapshot = await getCatalogue({
      adapter: fakeAdapter({ result: queryResult({ products: [productRow(overrides)] }) }),
      logger: recordingLogger(),
    });
    expect(snapshot.source).toBe("database");
    return snapshot;
  }

  it("enriches a product renamed in admin through its legacy slug", async () => {
    const snapshot = await loadOne({
      slug: "renamed-by-admin",
      legacySlugs: [enrichedStatic.slug],
      model: "ADMIN-ONLY-MODEL-XYZ",
    });
    const product = snapshot.products[0];

    expect(product.enrichmentSource).toBe("legacy_slug");
    expect(product.useCases).toEqual(enrichedStatic.useCases);
    expect(product.builderExclusions).toEqual(enrichedStatic.builderExclusions);
    expect(
      snapshot.diagnostics.some(
        (diagnostic) => diagnostic.code === "enrichment_matched_legacy_slug",
      ),
    ).toBe(true);
    // The public id stays the database slug — the checkout invariant is unaffected.
    expect(product.id).toBe("renamed-by-admin");
  });

  it("enriches through the exact model when no slug resolves", async () => {
    const snapshot = await loadOne({
      slug: "unknown-slug-xyz",
      legacySlugs: null,
      model: enrichedStatic.model,
    });
    const product = snapshot.products[0];

    expect(product.enrichmentSource).toBe("model");
    expect(product.useCases).toEqual(enrichedStatic.useCases);
    expect(
      snapshot.diagnostics.some((diagnostic) => diagnostic.code === "enrichment_matched_model"),
    ).toBe(true);
  });

  it("prefers the canonical slug over competing legacy and model candidates", async () => {
    const snapshot = await loadOne({
      slug: enrichedStatic.slug,
      legacySlugs: [otherStatic.slug],
      model: otherStatic.model,
    });
    const product = snapshot.products[0];

    expect(product.enrichmentSource).toBe("canonical_slug");
    expect(product.useCases).toEqual(enrichedStatic.useCases);
    expect(product.useCases).not.toEqual(otherStatic.useCases);
  });

  it("leaves optional fields empty and stays quiet for an admin-created product", async () => {
    const logger = recordingLogger();
    const snapshot = await getCatalogue({
      adapter: fakeAdapter({
        result: queryResult({
          products: [
            productRow({
              slug: "admin-only-product",
              legacySlugs: null,
              model: "ADMIN-ONLY-MODEL-ABC",
            }),
          ],
        }),
      }),
      logger,
    });
    const product = snapshot.products[0];

    expect(product.enrichmentSource).toBe("none");
    expect(product.useCases).toEqual([]);
    expect(product.relatedProductIds).toEqual([]);
    expect(product.builderCompatibleIds).toEqual([]);
    expect(product.builderExclusions).toEqual([]);
    expect(product.enrichedFields).toEqual([]);
    // Absent enrichment is normal, not a problem: nothing above debug level.
    expect(logger.entries.filter((entry) => entry.level !== "debug")).toEqual([]);
  });

  it("never lets enrichment overwrite database-authoritative values", async () => {
    const snapshot = await loadOne({
      slug: "renamed-authoritative",
      legacySlugs: [enrichedStatic.slug],
      model: "ADMIN-ONLY-MODEL-DEF",
      title: "Database title wins",
      sellingPriceInclGstPaise: 123_400,
      stockStatus: "quote_only",
      brandName: "Database brand",
      brandSlug: "database-brand",
    });
    const product = snapshot.products[0];

    expect(product.enrichmentSource).toBe("legacy_slug");
    expect(product.title).toBe("Database title wins");
    expect(product.title).not.toBe(enrichedStatic.title);
    expect(product.sellingPriceInclGstPaise).toBe(123_400);
    expect(product.stockStatus).toBe("quote_only");
    expect(product.brand).toBe("Database brand");
    expect(product.model).toBe("ADMIN-ONLY-MODEL-DEF");
  });

  it("resolves deterministically across repeated loads", async () => {
    const rows = queryResult({
      products: [
        productRow({ slug: relatedStatic.slug }),
        productRow({ slug: enrichedStatic.slug }),
      ],
    });
    const first = await getCatalogue({
      adapter: fakeAdapter({ result: rows }),
      logger: recordingLogger(),
    });
    const second = await getCatalogue({
      adapter: fakeAdapter({ result: rows }),
      logger: recordingLogger(),
    });

    expect(first.products.map((product) => product.enrichmentSource)).toEqual(
      second.products.map((product) => product.enrichmentSource),
    );
    expect(first.products.map((product) => product.useCases)).toEqual(
      second.products.map((product) => product.useCases),
    );
    expect(first.products.map((product) => product.builderCompatibleIds)).toEqual(
      second.products.map((product) => product.builderCompatibleIds),
    );
  });

  it("adds no database round trips", async () => {
    const adapter = fakeAdapter({
      result: queryResult({
        products: [
          productRow({ slug: enrichedStatic.slug }),
          productRow({ slug: "renamed-x", legacySlugs: [otherStatic.slug] }),
          productRow({ slug: "admin-only-y", model: "ADMIN-ONLY-MODEL-GHI" }),
        ],
      }),
    });
    await getCatalogue({ adapter, logger: recordingLogger() });

    expect(adapter.calls).toBe(1);
  });
});

// ─── M1.1: transitional image fallback ────────────────────────────────────

describe("image fallback policy", () => {
  it("always prefers database image rows over static images", async () => {
    const row = productRow({ slug: enrichedStatic.slug });
    const snapshot = await getCatalogue({
      adapter: fakeAdapter({
        result: queryResult({
          products: [row],
          images: [imageRow(row.id, { url: "/images/products/db-only.webp", position: 0 })],
        }),
      }),
      logger: recordingLogger(),
    });
    const product = snapshot.products[0];

    expect(product.images).toEqual(["/images/products/db-only.webp"]);
    expect(product.enrichedFields).not.toContain("images");
  });

  it("falls back to static images only when no valid database image row exists", async () => {
    const row = productRow({ slug: enrichedStatic.slug });
    const logger = recordingLogger();
    const snapshot = await getCatalogue({
      adapter: fakeAdapter({
        result: queryResult({
          products: [row],
          // Present but unusable: the fallback must treat this as "no image".
          images: [
            imageRow(row.id, { url: "   " }),
            imageRow(row.id, { url: "not a url at all" }),
          ],
        }),
      }),
      logger,
    });
    const product = snapshot.products[0];

    expect(product.images).toEqual(enrichedStatic.images);
    expect(product.enrichedFields).toContain("images");
    expect(logger.entries.some((entry) => entry.payload.code === "image_row_discarded")).toBe(true);
  });

  it("uses the placeholder only when neither source has an image", async () => {
    const snapshot = await getCatalogue({
      adapter: fakeAdapter({
        result: queryResult({
          products: [
            productRow({ slug: "no-image-anywhere", model: "ADMIN-ONLY-MODEL-JKL" }),
          ],
        }),
      }),
      logger: recordingLogger(),
    });
    const product = snapshot.products[0];

    expect(product.images).toEqual([PLACEHOLDER_IMAGE_URL]);
    expect(product.enrichedFields).not.toContain("images");
  });

  it("never emits a structurally broken public image URL", async () => {
    const row = productRow({ slug: "mixed-image-rows", model: "ADMIN-ONLY-MODEL-MNO" });
    const snapshot = await getCatalogue({
      adapter: fakeAdapter({
        result: queryResult({
          products: [row],
          images: [
            imageRow(row.id, { url: "javascript:alert(1)", position: 0 }),
            imageRow(row.id, { url: "  ", position: 1 }),
            imageRow(row.id, { url: "https://cdn.example.com/valid.webp", position: 2 }),
            imageRow(row.id, { url: "/images/products/valid.webp", position: 3 }),
          ],
        }),
      }),
      logger: recordingLogger(),
    });
    const product = snapshot.products[0];

    expect(product.images).toEqual([
      "https://cdn.example.com/valid.webp",
      "/images/products/valid.webp",
    ]);
    for (const url of product.images) {
      expect(url.startsWith("/") || /^https?:\/\//.test(url)).toBe(true);
    }
    expect(product.imageDetails[0].isPrimary).toBe(true);
  });
});

// ─── M1.1: configuration-check boundary ───────────────────────────────────

describe("configuration check boundary", () => {
  const SECRET = "postgresql://svc:top-s3cret@db.example.neon.tech/main";

  function throwingAdapter(error: unknown) {
    return {
      calls: 0,
      isConfigured: () => {
        throw error;
      },
      loadPublishedCatalogue: async () => queryResult(),
    };
  }

  it("does not reject when isConfigured() throws", async () => {
    const error = new Error(`env read failed for ${SECRET}`);
    error.name = "ConfigError";
    const snapshot = await getCatalogue({
      adapter: throwingAdapter(error),
      logger: recordingLogger(),
    });

    expect(snapshot.source).toBe("static");
    expect(snapshot.reason).toBe("configuration_check_failed");
    expect(snapshot.products).toHaveLength(STATIC_PRODUCT_COUNT);
  });

  it("survives a non-Error thrown from isConfigured()", async () => {
    const snapshot = await getCatalogue({
      adapter: throwingAdapter(SECRET),
      logger: recordingLogger(),
    });

    expect(snapshot.source).toBe("static");
    expect(snapshot.products).toHaveLength(STATIC_PRODUCT_COUNT);
  });

  it("redacts the configuration failure in logs and diagnostics", async () => {
    const error = new Error(`cannot parse ${SECRET}`);
    error.name = "ConfigError";
    const logger = recordingLogger();
    const snapshot = await getCatalogue({ adapter: throwingAdapter(error), logger });

    const text = `${loggedText(logger)} ${JSON.stringify(snapshot.diagnostics)}`;
    expect(text).not.toContain(SECRET);
    expect(text).not.toContain("top-s3cret");
    expect(text).not.toContain("db.example.neon.tech");
    expect(text).toContain("ConfigError");
    expect(logger.entries.some((entry) => entry.payload.code === "configuration_check_failed")).toBe(
      true,
    );
  });

  it("does not let one failing adapter suppress an unrelated one", async () => {
    const failing = throwingAdapter(new Error("boom"));
    const healthy = fakeAdapter({
      result: queryResult({ products: [productRow({ slug: "healthy-product" })] }),
    });

    const failed = await getCatalogue({ adapter: failing, logger: recordingLogger() });
    const ok = await getCatalogue({ adapter: healthy, logger: recordingLogger() });

    expect(failed.source).toBe("static");
    expect(ok.source).toBe("database");
    expect(ok.products.map((product) => product.slug)).toEqual(["healthy-product"]);
    expect(healthy.calls).toBe(1);
  });
});
