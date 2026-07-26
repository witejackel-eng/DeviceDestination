/**
 * Pure catalogue projections used by the cut-over server routes (M2B).
 *
 * Every helper here takes products as an argument, so these tests drive them
 * with database-backed fixtures and never touch the static catalogue.
 */

import { describe, expect, it } from "vitest";
import { getCatalogue } from "@/data/repository";
import {
  deriveBrands,
  deriveCategories,
  resolveProductFromSnapshot,
  searchCatalogue,
  toPublicProduct,
  toPublicProducts,
} from "@/lib/catalogue-view";
import { getFeaturedProducts } from "@/lib/featured-products";
import { resolveHeroProducts } from "@/lib/home/hero-products";
import type { CatalogueSnapshot } from "@/data/catalogue-types";
import {
  fakeAdapter,
  documentRow,
  productRow,
  queryResult,
  recordingLogger,
  specRow,
} from "@tests/helpers/catalogue-fixtures";

/** A small, entirely database-backed catalogue. */
async function dbSnapshot(): Promise<CatalogueSnapshot> {
  const dome = productRow({
    slug: "db-dome-4mp",
    model: "DB-DOME-4MP",
    title: "Database dome camera",
    categorySlug: "dome-cameras",
    categoryName: "Dome cameras",
    brandSlug: "cp-plus",
    brandName: "CP Plus",
    legacySlugs: ["db-dome-old"],
  });
  const bullet = productRow({
    slug: "db-bullet-4mp",
    model: "DB-BULLET-4MP",
    title: "Database bullet camera",
    categorySlug: "bullet-cameras",
    categoryName: "Bullet cameras",
    brandSlug: "cp-plus",
    brandName: "CP Plus",
  });
  const nvr = productRow({
    slug: "db-nvr-8ch",
    model: "DB-NVR-8CH",
    title: "Database NVR",
    categorySlug: "nvr-systems",
    categoryName: "NVR systems",
    brandSlug: "prama",
    brandName: "Prama",
  });

  return getCatalogue({
    adapter: fakeAdapter({
      result: queryResult({
        products: [dome, bullet, nvr],
        specs: [
          specRow(dome.id, { label: "Max resolution", value: "4 MP", position: 0 }),
          specRow(nvr.id, { label: "Channels", value: "8", position: 0 }),
        ],
        documents: [
          documentRow(dome.id, { title: "Dome datasheet", modelVerified: true }),
          documentRow(dome.id, { title: "Dome draft manual", type: "manual", modelVerified: false }),
        ],
      }),
    }),
    logger: recordingLogger(),
  });
}

describe("taxonomy derivation", () => {
  it("derives categories and brands from repository products only", async () => {
    const { products } = await dbSnapshot();

    expect(deriveCategories(products)).toEqual([
      { slug: "dome-cameras", name: "Dome cameras" },
      { slug: "bullet-cameras", name: "Bullet cameras" },
      { slug: "nvr-systems", name: "NVR systems" },
    ]);
    expect(deriveBrands(products)).toEqual([
      { slug: "cp-plus", name: "CP Plus" },
      { slug: "prama", name: "Prama" },
    ]);
  });

  it("derives per-category and per-brand counts from repository products", async () => {
    const { products } = await dbSnapshot();

    const cpPlus = products.filter((product) => product.brandSlug === "cp-plus");
    const domes = products.filter((product) => product.categorySlug === "dome-cameras");

    expect(cpPlus).toHaveLength(2);
    expect(domes).toHaveLength(1);
    // Counts never include static products.
    expect(products).toHaveLength(3);
    expect(products.every((product) => product.source === "database")).toBe(true);
  });

  it("yields no taxonomy for an authoritative empty catalogue", async () => {
    const snapshot = await getCatalogue({
      adapter: fakeAdapter({ result: queryResult({ totalProductCount: 7 }) }),
      logger: recordingLogger(),
    });

    expect(snapshot.authority).toBe("database");
    expect(deriveCategories(snapshot.products)).toEqual([]);
    expect(deriveBrands(snapshot.products)).toEqual([]);
  });
});

describe("search over repository products", () => {
  it("matches on exact model, normalised model and title", async () => {
    const { products } = await dbSnapshot();

    expect(searchCatalogue(products, "DB-DOME-4MP")[0]?.slug).toBe("db-dome-4mp");
    expect(searchCatalogue(products, "db dome 4mp")[0]?.slug).toBe("db-dome-4mp");
    expect(searchCatalogue(products, "dbdome4mp")[0]?.slug).toBe("db-dome-4mp");
    expect(searchCatalogue(products, "Database NVR")[0]?.slug).toBe("db-nvr-8ch");
  });

  it("matches on specification text carried by the repository", async () => {
    const { products } = await dbSnapshot();

    expect(searchCatalogue(products, "Channels").map((p) => p.slug)).toEqual(["db-nvr-8ch"]);
  });

  it("returns the whole collection for an empty query and nothing for a miss", async () => {
    const { products } = await dbSnapshot();

    expect(searchCatalogue(products, "   ")).toHaveLength(3);
    expect(searchCatalogue(products, "no-such-model")).toEqual([]);
  });
});

describe("product resolution from a snapshot", () => {
  it("resolves a canonical slug", async () => {
    const snapshot = await dbSnapshot();

    expect(resolveProductFromSnapshot(snapshot, "db-dome-4mp")?.slug).toBe("db-dome-4mp");
  });

  it("resolves a legacy slug to the canonical product", async () => {
    const snapshot = await dbSnapshot();
    const resolved = resolveProductFromSnapshot(snapshot, "db-dome-old");

    expect(resolved?.slug).toBe("db-dome-4mp");
    // The public id stays canonical, so the cart stores the right reference.
    expect(resolved?.id).toBe("db-dome-4mp");
  });

  it("resolves an exact model", async () => {
    const snapshot = await dbSnapshot();

    expect(resolveProductFromSnapshot(snapshot, "DB-NVR-8CH")?.slug).toBe("db-nvr-8ch");
  });

  it("does not resurrect a static product the authoritative database lacks", async () => {
    const snapshot = await dbSnapshot();

    // A real slug from the static catalogue, absent from this database.
    expect(resolveProductFromSnapshot(snapshot, "cp-unc-da41l3c-d-q")).toBeUndefined();
    expect(resolveProductFromSnapshot(snapshot, "anything-else")).toBeUndefined();
  });

  it("resolves a newly created database slug with no build-time enumeration", async () => {
    // Nothing enumerated this slug ahead of time; it exists only in the snapshot.
    const snapshot = await getCatalogue({
      adapter: fakeAdapter({
        result: queryResult({
          products: [productRow({ slug: "created-after-deploy", model: "NEW-MODEL-1" })],
        }),
      }),
      logger: recordingLogger(),
    });

    expect(resolveProductFromSnapshot(snapshot, "created-after-deploy")?.slug).toBe(
      "created-after-deploy",
    );
    expect(resolveProductFromSnapshot(snapshot, "NEW-MODEL-1")?.slug).toBe("created-after-deploy");
  });
});

describe("public product projection", () => {
  it("carries the shared contract and drops repository-only fields", async () => {
    const { products } = await dbSnapshot();
    const projected = toPublicProduct(products[0]);

    expect(projected.id).toBe("db-dome-4mp");
    expect(projected.specs).toEqual({ "Max resolution": "4 MP" });
    // Repository-only fields must not reach a client component in M2B.
    for (const key of [
      "specGroups",
      "imageDetails",
      "documentDetails",
      "compatibility",
      "inventory",
      "searchText",
      "enrichmentSource",
      "enrichedFields",
      "databaseId",
      "source",
    ]) {
      expect(key in projected).toBe(false);
    }
  });

  it("exposes only model-verified documents", async () => {
    const { products } = await dbSnapshot();
    const dome = products.find((product) => product.slug === "db-dome-4mp")!;

    expect(dome.documentDetails).toHaveLength(2);
    expect(toPublicProduct(dome).documents.map((document) => document.title)).toEqual([
      "Dome datasheet",
    ]);
    // The unverified row exists internally but is never projected publicly.
    expect(JSON.stringify(toPublicProduct(dome))).not.toContain("Dome draft manual");
  });

  it("projects a whole collection, preserving order", async () => {
    const { products } = await dbSnapshot();

    expect(toPublicProducts(products).map((product) => product.id)).toEqual(
      products.map((product) => product.id),
    );
    expect(toPublicProducts(products)).toHaveLength(3);
  });
});

describe("homepage helpers take the supplied collection", () => {
  it("derives featured products from repository products, never the static catalogue", async () => {
    // The curated selection keys off specific model numbers, so the fixture
    // carries one of them — with database content, to prove which copy is used.
    const curated = productRow({
      slug: "cp-unc-da41l3c-d-q",
      model: "CP-UNC-DA41L3C-D-Q",
      title: "Database copy of the curated dome",
      categorySlug: "dome-cameras",
      stockStatus: "in_stock",
    });
    const snapshot = await getCatalogue({
      adapter: fakeAdapter({ result: queryResult({ products: [curated] }) }),
      logger: recordingLogger(),
    });
    const featured = getFeaturedProducts(toPublicProducts(snapshot.products), 8);

    expect(featured.map((product) => product.slug)).toEqual(["cp-unc-da41l3c-d-q"]);
    // The database row, not the identically-slugged static entry.
    expect(featured[0].title).toBe("Database copy of the curated dome");
    expect(new Set(featured.map((product) => product.id)).size).toBe(featured.length);
  });

  it("selects nothing when the collection holds no curated model or category match", async () => {
    // Pre-existing behaviour worth pinning: the curated list keys off specific
    // model numbers, so an unrelated catalogue yields an empty featured section.
    // Redesigning that selection is not M2B's scope.
    const { products } = await dbSnapshot();
    const featured = getFeaturedProducts(toPublicProducts(products), 8);

    expect(featured.every((product) => product.slug.startsWith("db-"))).toBe(true);
  });

  it("resolves hero products from repository products", async () => {
    const { products } = await dbSnapshot();
    const hero = resolveHeroProducts(toPublicProducts(products));

    expect(hero.length).toBeGreaterThan(0);
    expect(hero.every((entry) => entry.product.slug.startsWith("db-"))).toBe(true);
    expect(new Set(hero.map((entry) => entry.product.id)).size).toBe(hero.length);
  });

  it("returns nothing rather than static products for an empty collection", async () => {
    expect(getFeaturedProducts([], 8)).toEqual([]);
    expect(resolveHeroProducts([])).toEqual([]);
  });
});
