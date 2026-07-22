import { eq } from "drizzle-orm";
import { getDb } from "../src/db/client";
import * as table from "../src/db/schema";
import { brands, catalogue, categories } from "../src/data/catalog";

const db = getDb();
for (const brand of brands) {
  await db
    .insert(table.brands)
    .values({
      name: brand.name,
      slug: brand.slug,
      websiteUrl: brand.slug === "cp-plus" ? "https://cpplusworld.com" : "https://esslsecurity.com",
    })
    .onConflictDoUpdate({ target: table.brands.slug, set: { name: brand.name } });
}
for (const category of categories) {
  await db
    .insert(table.categories)
    .values({ name: category.name, slug: category.slug })
    .onConflictDoUpdate({ target: table.categories.slug, set: { name: category.name } });
}

const brandRows = await db.select().from(table.brands);
const categoryRows = await db.select().from(table.categories);

for (const product of catalogue) {
  const brandId = brandRows.find((row) => row.slug === product.brandSlug)?.id;
  const categoryId = categoryRows.find((row) => row.slug === product.categorySlug)?.id;
  if (!brandId || !categoryId) throw new Error(`Missing seed relation for ${product.model}`);
  const [saved] = await db
    .insert(table.products)
    .values({
      slug: product.slug,
      legacySlugs: product.legacySlugs,
      model: product.model,
      title: product.title,
      shortDescription: product.shortDescription,
      longDescription: product.longDescription,
      brandId,
      categoryId,
      status: "published",
      stockStatus: product.stockStatus,
      sellingPriceInclGstPaise: product.sellingPriceInclGstPaise,
      mrpInclGstPaise: product.mrpInclGstPaise,
      compareAtPriceInclGstPaise: product.compareAtPriceInclGstPaise,
      compareAtLabel: product.compareAtLabel,
      gstRateBasisPoints: product.gstRateBasisPoints,
      gstIncluded: true,
      priceSourceStatus: product.priceSourceStatus,
      priceVerifiedAt: product.priceVerifiedAt ? new Date(product.priceVerifiedAt) : null,
      warrantySummary: product.warrantySummary,
      officialSourceUrl: product.officialSourceUrl,
      verifiedAt: new Date(product.verifiedAt),
    })
    .onConflictDoUpdate({
      target: table.products.model,
      set: {
        slug: product.slug,
        title: product.title,
        shortDescription: product.shortDescription,
        officialSourceUrl: product.officialSourceUrl,
        sellingPriceInclGstPaise: product.sellingPriceInclGstPaise,
        priceSourceStatus: product.priceSourceStatus,
        verifiedAt: new Date(product.verifiedAt),
      },
    })
    .returning({ id: table.products.id });
  const productId = saved.id;
  await db.delete(table.productImages).where(eq(table.productImages.productId, productId));
  await db.delete(table.productDocuments).where(eq(table.productDocuments.productId, productId));
  await db.delete(table.productSpecs).where(eq(table.productSpecs.productId, productId));
  await db.delete(table.productHighlights).where(eq(table.productHighlights.productId, productId));
  if (product.images.length)
    await db.insert(table.productImages).values(
      product.images.map((url, position) => ({
        productId,
        url,
        alt: `${product.brand} ${product.model}`,
        position,
      })),
    );
  if (product.documents.length)
    await db.insert(table.productDocuments).values(
      product.documents.map((document) => ({
        productId,
        type: document.type,
        title: document.title,
        url: document.url,
        modelVerified: true,
      })),
    );
  const specs = Object.entries(product.specs).map(([label, value], position) => ({
    productId,
    label,
    value,
    position,
  }));
  if (specs.length) await db.insert(table.productSpecs).values(specs);
  if (product.highlights.length)
    await db
      .insert(table.productHighlights)
      .values(product.highlights.map((text, position) => ({ productId, text, position })));
}
console.log(`Seeded ${catalogue.length} public products without supplier costs.`);
