/**
 * Catalogue repository — optional real-PostgreSQL suite (M1).
 *
 * Exercises the Drizzle adapter against a real database so the SQL, the joins
 * and the column mapping are proven, not just the pure mapping logic.
 *
 * Requires TEST_DATABASE_URL. Without it every test here skips with an explicit
 * reason and the deterministic suite in `tests/unit/catalogue-repository.test.ts`
 * still covers all mapping, fallback, validation, ordering and error handling.
 * DATABASE_URL is never used as a fallback.
 */

import { randomUUID } from "node:crypto";
import { inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  brands,
  categories,
  inventory,
  productCompatibility,
  productDocuments,
  productHighlights,
  productImages,
  products,
  productSpecs,
} from "@/db/schema";
import { drizzleCatalogueAdapter } from "@/data/catalogue-db-adapter";
import { getCatalogue, resetCatalogueRepositoryState } from "@/data/repository";
import {
  getTestDb,
  hasTestDb,
  skipMessage,
  snapshotEnv,
  setupTestEnv,
  teardownTestEnv,
} from "@tests/helpers/setup";

if (!hasTestDb()) {
  console.info(skipMessage("catalogue repository real-database suite"));
}

const envSnapshot = snapshotEnv();

const brandId = randomUUID();
const categoryId = randomUUID();
const publishedId = randomUUID();
const partnerId = randomUUID();
const draftId = randomUUID();

const suffix = randomUUID().slice(0, 8);
const publishedSlug = `itest-catalogue-published-${suffix}`;
const partnerSlug = `itest-catalogue-partner-${suffix}`;
const draftSlug = `itest-catalogue-draft-${suffix}`;

describe.skipIf(!hasTestDb())("catalogue repository — real database", () => {
  beforeAll(async () => {
    setupTestEnv();
    resetCatalogueRepositoryState();
    const db = getTestDb();

    await db.insert(brands).values({
      id: brandId,
      name: `ITest Brand ${suffix}`,
      slug: `itest-brand-${suffix}`,
    });
    await db.insert(categories).values({
      id: categoryId,
      name: `ITest Category ${suffix}`,
      slug: `itest-category-${suffix}`,
    });

    const base = {
      brandId,
      categoryId,
      shortDescription: "Integration fixture product.",
      officialSourceUrl: "https://example.com/itest",
      verifiedAt: new Date("2026-07-22T00:00:00.000Z"),
      priceVerifiedAt: new Date("2026-07-22T00:00:00.000Z"),
      gstRateBasisPoints: 1800,
      sellingPriceInclGstPaise: 249_900,
    } as const;

    await db.insert(products).values([
      {
        ...base,
        id: publishedId,
        slug: publishedSlug,
        model: `ITEST-PUB-${suffix}`.toUpperCase(),
        title: "ITest published product",
        status: "published",
        stockStatus: "in_stock",
        priceSourceStatus: "verified",
      },
      {
        ...base,
        id: partnerId,
        slug: partnerSlug,
        model: `ITEST-PARTNER-${suffix}`.toUpperCase(),
        title: "ITest partner product",
        status: "published",
        stockStatus: "in_stock",
        priceSourceStatus: "needs_review",
      },
      {
        ...base,
        id: draftId,
        slug: draftSlug,
        model: `ITEST-DRAFT-${suffix}`.toUpperCase(),
        title: "ITest draft product",
        status: "draft",
        stockStatus: "in_stock",
        priceSourceStatus: "verified",
      },
    ]);

    // Inserted out of order on purpose — ordering must come from the columns.
    await db.insert(productImages).values([
      { productId: publishedId, url: "/images/products/itest-c.webp", alt: "Third", position: 2 },
      { productId: publishedId, url: "/images/products/itest-a.webp", alt: "First", position: 0 },
      { productId: publishedId, url: "/images/products/itest-b.webp", alt: "Second", position: 1 },
    ]);
    await db.insert(productSpecs).values([
      { productId: publishedId, groupName: "Power", label: "Input", value: "12 V DC", position: 10 },
      { productId: publishedId, groupName: "Imaging", label: "Sensor", value: "1/3 inch", position: 0 },
      { productId: publishedId, groupName: "Power", label: "Draw", value: "6 W", position: 11 },
    ]);
    await db.insert(productHighlights).values([
      { productId: publishedId, text: "Second highlight", position: 1 },
      { productId: publishedId, text: "First highlight", position: 0 },
    ]);
    await db.insert(productDocuments).values([
      {
        productId: publishedId,
        type: "datasheet",
        title: "ITest datasheet",
        url: "/docs/datasheets/itest.pdf",
        modelVerified: true,
      },
      {
        productId: publishedId,
        type: "manual",
        title: "ITest unverified manual",
        url: "/docs/manuals/itest.pdf",
        modelVerified: false,
      },
    ]);
    await db
      .insert(productCompatibility)
      .values([{ productId: publishedId, compatibleProductId: partnerId, note: "Tested pair" }]);
    await db
      .insert(inventory)
      .values([{ productId: publishedId, quantityAvailable: 12, reserved: 4 }]);
  });

  afterAll(async () => {
    const db = getTestDb();
    const ids = [publishedId, partnerId, draftId];
    await db.delete(productCompatibility).where(inArray(productCompatibility.productId, ids));
    await db.delete(inventory).where(inArray(inventory.productId, ids));
    await db.delete(productDocuments).where(inArray(productDocuments.productId, ids));
    await db.delete(productHighlights).where(inArray(productHighlights.productId, ids));
    await db.delete(productSpecs).where(inArray(productSpecs.productId, ids));
    await db.delete(productImages).where(inArray(productImages.productId, ids));
    await db.delete(products).where(inArray(products.id, ids));
    await db.delete(categories).where(inArray(categories.id, [categoryId]));
    await db.delete(brands).where(inArray(brands.id, [brandId]));
    teardownTestEnv(envSnapshot);
    resetCatalogueRepositoryState();
  });

  it("reports the database as configured and loads published rows only", async () => {
    expect(drizzleCatalogueAdapter.isConfigured()).toBe(true);
    const result = await drizzleCatalogueAdapter.loadPublishedCatalogue();
    const slugs = result.products.map((product) => product.slug);

    expect(slugs).toContain(publishedSlug);
    expect(slugs).toContain(partnerSlug);
    expect(slugs).not.toContain(draftSlug);
  });

  it("serves the database catalogue with the slug as the public id", async () => {
    const snapshot = await getCatalogue();
    const product = snapshot.products.find((entry) => entry.slug === publishedSlug);

    expect(snapshot.source).toBe("database");
    expect(product).toBeDefined();
    expect(product!.id).toBe(publishedSlug);
    expect(product!.databaseId).toBe(publishedId);
  });

  it("preserves ordering, grouping and verification state through real SQL", async () => {
    const snapshot = await getCatalogue();
    const product = snapshot.products.find((entry) => entry.slug === publishedSlug)!;

    expect(product.images).toEqual([
      "/images/products/itest-a.webp",
      "/images/products/itest-b.webp",
      "/images/products/itest-c.webp",
    ]);
    expect(product.specGroups.map((group) => group.name)).toEqual(["Imaging", "Power"]);
    expect(product.specGroups[1].rows.map((row) => row.label)).toEqual(["Input", "Draw"]);
    expect(product.highlights).toEqual(["First highlight", "Second highlight"]);
    expect(product.documentDetails).toHaveLength(2);
    expect(product.documents.map((document) => document.title)).toEqual(["ITest datasheet"]);
    expect(product.builderCompatibleIds).toEqual([partnerSlug]);
    expect(product.inventory).toMatchObject({
      onHandUnits: 12,
      reservedUnits: 4,
      availableUnits: 8,
    });
  });

  it("normalises the snake_case price source enum to the public contract", async () => {
    const snapshot = await getCatalogue();
    const partner = snapshot.products.find((entry) => entry.slug === partnerSlug)!;

    expect(partner.priceSourceStatus).toBe("needs-review");
  });
});
