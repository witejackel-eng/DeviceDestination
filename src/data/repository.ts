import { and, eq, inArray, or } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/db/client";
import {
  brands as brandsTable,
  categories as categoriesTable,
  productDocuments,
  productHighlights,
  productImages,
  products as productsTable,
  productSpecs,
} from "@/db/schema";
import { catalogue, getProduct as getSeedProduct } from "@/data/catalog";
import type { Product } from "@/lib/products";

export async function listProducts(): Promise<Product[]> {
  if (!isDatabaseConfigured()) return catalogue;

  const db = getDb();
  const rows = await db
    .select({ product: productsTable, brand: brandsTable, category: categoriesTable })
    .from(productsTable)
    .innerJoin(brandsTable, eq(productsTable.brandId, brandsTable.id))
    .innerJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .where(eq(productsTable.status, "published"));

  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.product.id);
  const [images, documents, specs, highlights] = await Promise.all([
    db.select().from(productImages).where(inArray(productImages.productId, ids)),
    db.select().from(productDocuments).where(inArray(productDocuments.productId, ids)),
    db.select().from(productSpecs).where(inArray(productSpecs.productId, ids)),
    db.select().from(productHighlights).where(inArray(productHighlights.productId, ids)),
  ]);

  return rows.map(({ product, brand, category }) => ({
    id: product.id,
    slug: product.slug,
    legacySlugs: product.legacySlugs,
    model: product.model,
    brand: brand.name,
    brandSlug: brand.slug,
    category: category.name,
    categorySlug: category.slug,
    title: product.title,
    shortDescription: product.shortDescription,
    longDescription: product.longDescription ?? product.shortDescription,
    images: images
      .filter((image) => image.productId === product.id)
      .sort((a, b) => a.position - b.position)
      .map((image) => image.url),
    imageModel: product.model,
    documents: documents
      .filter((document) => document.productId === product.id && document.modelVerified)
      .map((document) => ({
        type: document.type as "datasheet" | "manual" | "installation-guide",
        title: document.title,
        url: document.url,
        model: product.model,
      })),
    specs: Object.fromEntries(
      specs
        .filter((spec) => spec.productId === product.id)
        .sort((a, b) => a.position - b.position)
        .map((spec) => [spec.label, spec.value]),
    ),
    highlights: highlights
      .filter((highlight) => highlight.productId === product.id)
      .sort((a, b) => a.position - b.position)
      .map((highlight) => highlight.text),
    useCases: [],
    stockStatus: product.stockStatus,
    sellingPriceInclGstPaise: product.sellingPriceInclGstPaise,
    mrpInclGstPaise: product.mrpInclGstPaise,
    compareAtPriceInclGstPaise: product.compareAtPriceInclGstPaise,
    compareAtLabel: product.compareAtLabel as Product["compareAtLabel"],
    gstRateBasisPoints: product.gstRateBasisPoints,
    gstIncluded: true,
    priceVerifiedAt: product.priceVerifiedAt?.toISOString() ?? null,
    priceSourceStatus: product.priceSourceStatus as Product["priceSourceStatus"],
    officialSourceUrl: product.officialSourceUrl,
    verifiedAt: product.verifiedAt.toISOString(),
    warrantySummary: product.warrantySummary ?? "OEM warranty terms apply",
    relatedProductIds: [],
    builderCompatibleIds: [],
    builderExclusions: [],
  }));
}

export async function getProduct(slug: string): Promise<Product | undefined> {
  if (!isDatabaseConfigured()) return getSeedProduct(slug);
  const db = getDb();
  const result = await db
    .select({ slug: productsTable.slug, legacySlugs: productsTable.legacySlugs })
    .from(productsTable)
    .where(
      and(
        eq(productsTable.status, "published"),
        or(eq(productsTable.slug, slug), eq(productsTable.model, slug)),
      ),
    )
    .limit(1);
  const canonicalSlug = result[0]?.slug;
  if (!canonicalSlug) {
    const all = await listProducts();
    return all.find((product) => product.legacySlugs.includes(slug));
  }
  const all = await listProducts();
  return all.find((product) => product.slug === canonicalSlug);
}
