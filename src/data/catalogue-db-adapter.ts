/**
 * Drizzle implementation of the catalogue database adapter (M1).
 *
 * **Server-only.** This module reaches `@/db/client` and must never be pulled
 * into a client bundle. `tests/unit/catalogue-server-boundary.test.ts` enforces
 * that no `"use client"` module imports it, directly or transitively.
 *
 * Query budget per catalogue load: one joined product query plus six batched
 * child queries, all keyed by `product_id IN (…)`. A seventh count query runs
 * only when the published query returns nothing, to tell an empty database
 * apart from one with no published rows.
 */

import { asc, eq, inArray, sql } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/db/client";
import {
  brands as brandsTable,
  categories as categoriesTable,
  inventory as inventoryTable,
  productCompatibility,
  productDocuments,
  productHighlights,
  productImages,
  products as productsTable,
  productSpecs,
} from "@/db/schema";
import type { CatalogueDatabaseAdapter, CatalogueQueryResult } from "@/data/catalogue-types";

export type CatalogueDatabaseErrorKind = "unavailable" | "query_failed";

/**
 * Carries only a failure classification and the original error's constructor
 * name. The original message is deliberately dropped — driver errors routinely
 * embed the connection string.
 */
export class CatalogueDatabaseError extends Error {
  readonly kind: CatalogueDatabaseErrorKind;
  readonly causeName: string;

  constructor(kind: CatalogueDatabaseErrorKind, causeName: string) {
    super(
      kind === "unavailable"
        ? "Catalogue database is unavailable"
        : "Catalogue query failed to execute",
    );
    this.name = "CatalogueDatabaseError";
    this.kind = kind;
    this.causeName = causeName;
  }
}

function causeNameOf(error: unknown): string {
  return error instanceof Error ? error.name : "UnknownError";
}

export const drizzleCatalogueAdapter: CatalogueDatabaseAdapter = {
  isConfigured: () => isDatabaseConfigured(),

  async loadPublishedCatalogue(): Promise<CatalogueQueryResult> {
    let db: ReturnType<typeof getDb>;
    try {
      db = getDb();
    } catch (error) {
      throw new CatalogueDatabaseError("unavailable", causeNameOf(error));
    }

    try {
      const products = await db
        .select({
          id: productsTable.id,
          slug: productsTable.slug,
          legacySlugs: productsTable.legacySlugs,
          model: productsTable.model,
          title: productsTable.title,
          shortDescription: productsTable.shortDescription,
          longDescription: productsTable.longDescription,
          brandName: brandsTable.name,
          brandSlug: brandsTable.slug,
          categoryName: categoriesTable.name,
          categorySlug: categoriesTable.slug,
          status: productsTable.status,
          stockStatus: productsTable.stockStatus,
          leadTime: productsTable.leadTime,
          sellingPriceInclGstPaise: productsTable.sellingPriceInclGstPaise,
          mrpInclGstPaise: productsTable.mrpInclGstPaise,
          compareAtPriceInclGstPaise: productsTable.compareAtPriceInclGstPaise,
          compareAtLabel: productsTable.compareAtLabel,
          gstRateBasisPoints: productsTable.gstRateBasisPoints,
          gstIncluded: productsTable.gstIncluded,
          priceSourceStatus: productsTable.priceSourceStatus,
          priceVerifiedAt: productsTable.priceVerifiedAt,
          warrantySummary: productsTable.warrantySummary,
          officialSourceUrl: productsTable.officialSourceUrl,
          verifiedAt: productsTable.verifiedAt,
        })
        .from(productsTable)
        .innerJoin(brandsTable, eq(productsTable.brandId, brandsTable.id))
        .innerJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
        .where(eq(productsTable.status, "published"))
        .orderBy(asc(productsTable.slug));

      if (products.length === 0) {
        const [counted] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(productsTable);
        return {
          products: [],
          images: [],
          documents: [],
          specs: [],
          highlights: [],
          compatibility: [],
          inventory: [],
          totalProductCount: Number(counted?.count ?? 0),
        };
      }

      const ids = products.map((product) => product.id);
      const [images, documents, specs, highlights, compatibility, inventory] = await Promise.all([
        db
          .select({
            productId: productImages.productId,
            url: productImages.url,
            alt: productImages.alt,
            position: productImages.position,
          })
          .from(productImages)
          .where(inArray(productImages.productId, ids))
          .orderBy(asc(productImages.position)),
        db
          .select({
            id: productDocuments.id,
            productId: productDocuments.productId,
            type: productDocuments.type,
            title: productDocuments.title,
            url: productDocuments.url,
            modelVerified: productDocuments.modelVerified,
          })
          .from(productDocuments)
          .where(inArray(productDocuments.productId, ids)),
        db
          .select({
            productId: productSpecs.productId,
            groupName: productSpecs.groupName,
            label: productSpecs.label,
            value: productSpecs.value,
            position: productSpecs.position,
          })
          .from(productSpecs)
          .where(inArray(productSpecs.productId, ids))
          .orderBy(asc(productSpecs.groupName), asc(productSpecs.position)),
        db
          .select({
            productId: productHighlights.productId,
            text: productHighlights.text,
            position: productHighlights.position,
          })
          .from(productHighlights)
          .where(inArray(productHighlights.productId, ids))
          .orderBy(asc(productHighlights.position)),
        db
          .select({
            productId: productCompatibility.productId,
            compatibleProductId: productCompatibility.compatibleProductId,
            note: productCompatibility.note,
          })
          .from(productCompatibility)
          .where(inArray(productCompatibility.productId, ids)),
        db
          .select({
            productId: inventoryTable.productId,
            quantityAvailable: inventoryTable.quantityAvailable,
            reserved: inventoryTable.reserved,
            leadTime: inventoryTable.leadTime,
          })
          .from(inventoryTable)
          .where(inArray(inventoryTable.productId, ids)),
      ]);

      return { products, images, documents, specs, highlights, compatibility, inventory };
    } catch (error) {
      throw new CatalogueDatabaseError("query_failed", causeNameOf(error));
    }
  },
};
