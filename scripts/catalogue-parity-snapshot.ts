// Writes a stable, machine-diffable snapshot of every customer-visible catalogue
// fact so a redesign can be proven not to have dropped product data.
//
// Usage:
//   node --import tsx scripts/catalogue-parity-snapshot.ts before
//   node --import tsx scripts/catalogue-parity-snapshot.ts after
//   node --import tsx scripts/catalogue-parity-snapshot.ts compare

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { catalogue } from "../src/data/catalog";

const OUT_DIR = join(process.cwd(), "reports", "parity");

type Snapshot = ReturnType<typeof buildSnapshot>;

function buildSnapshot() {
  return {
    productCount: catalogue.length,
    products: [...catalogue]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((product) => ({
        id: product.id,
        slug: product.slug,
        legacySlugs: [...product.legacySlugs].sort(),
        model: product.model,
        brand: product.brand,
        brandSlug: product.brandSlug,
        category: product.category,
        categorySlug: product.categorySlug,
        title: product.title,
        shortDescription: product.shortDescription,
        longDescription: product.longDescription,
        images: product.images,
        imageModel: product.imageModel,
        documents: [...product.documents]
          .map((document) => `${document.type}|${document.model}|${document.title}|${document.url}`)
          .sort(),
        specs: Object.fromEntries(Object.entries(product.specs).sort(([a], [b]) => a.localeCompare(b))),
        highlights: product.highlights,
        useCases: product.useCases,
        stockStatus: product.stockStatus,
        sellingPriceInclGstPaise: product.sellingPriceInclGstPaise,
        mrpInclGstPaise: product.mrpInclGstPaise,
        compareAtPriceInclGstPaise: product.compareAtPriceInclGstPaise,
        compareAtLabel: product.compareAtLabel,
        gstRateBasisPoints: product.gstRateBasisPoints,
        priceVerifiedAt: product.priceVerifiedAt,
        priceSourceStatus: product.priceSourceStatus,
        officialSourceUrl: product.officialSourceUrl,
        warrantySummary: product.warrantySummary,
        relatedProductIds: [...product.relatedProductIds].sort(),
        builderCompatibleIds: [...product.builderCompatibleIds].sort(),
        builderExclusions: [...product.builderExclusions].sort(),
      })),
  };
}

function write(label: string) {
  mkdirSync(OUT_DIR, { recursive: true });
  const target = join(OUT_DIR, `catalogue-${label}.json`);
  writeFileSync(target, `${JSON.stringify(buildSnapshot(), null, 2)}\n`);
  console.log(`Wrote ${target} (${catalogue.length} products).`);
}

function load(label: string): Snapshot {
  const target = join(OUT_DIR, `catalogue-${label}.json`);
  if (!existsSync(target)) throw new Error(`Missing snapshot: ${target}`);
  return JSON.parse(readFileSync(target, "utf8")) as Snapshot;
}

// Fields whose value may legitimately be re-presented but never lost. Image
// paths are compared by basename because the image-processing pipeline may move
// an asset into public/images/products/processed/ with a new extension.
function imageKey(path: string) {
  return path
    .split("/")
    .pop()!
    .replace(/\.(png|jpe?g|webp|avif)$/i, "")
    .toLowerCase();
}

function compare() {
  const before = load("before");
  const after = load("after");
  const problems: string[] = [];

  const beforeById = new Map(before.products.map((product) => [product.id, product]));
  const afterById = new Map(after.products.map((product) => [product.id, product]));

  for (const [id, previous] of beforeById) {
    const current = afterById.get(id);
    if (!current) {
      problems.push(`REMOVED PRODUCT: ${id} (${previous.model})`);
      continue;
    }
    const identityFields = [
      "slug",
      "model",
      "brand",
      "category",
      "categorySlug",
      "title",
      "shortDescription",
      "longDescription",
      "imageModel",
      "stockStatus",
      "sellingPriceInclGstPaise",
      "mrpInclGstPaise",
      "compareAtPriceInclGstPaise",
      "gstRateBasisPoints",
      "priceVerifiedAt",
      "priceSourceStatus",
      "officialSourceUrl",
      "warrantySummary",
    ] as const;

    for (const field of identityFields) {
      if (JSON.stringify(previous[field]) !== JSON.stringify(current[field])) {
        problems.push(
          `CHANGED ${id}.${field}: ${JSON.stringify(previous[field])} -> ${JSON.stringify(current[field])}`,
        );
      }
    }

    for (const slug of previous.legacySlugs) {
      if (!current.legacySlugs.includes(slug)) problems.push(`LOST legacy slug ${slug} on ${id}`);
    }
    for (const document of previous.documents) {
      if (!current.documents.includes(document)) problems.push(`LOST document on ${id}: ${document}`);
    }
    for (const [key, value] of Object.entries(previous.specs)) {
      if (current.specs[key] !== value) problems.push(`LOST/CHANGED spec ${id}.${key}: "${value}" -> "${current.specs[key] ?? "(missing)"}"`);
    }
    for (const highlight of previous.highlights) {
      if (!current.highlights.includes(highlight)) problems.push(`LOST highlight on ${id}: ${highlight}`);
    }
    for (const useCase of previous.useCases) {
      if (!current.useCases.includes(useCase)) problems.push(`LOST use case on ${id}: ${useCase}`);
    }
    const currentImageKeys = new Set(current.images.map(imageKey));
    for (const image of previous.images) {
      if (!currentImageKeys.has(imageKey(image))) problems.push(`LOST image on ${id}: ${image}`);
    }
    if (current.images.length < previous.images.length) {
      problems.push(`FEWER images on ${id}: ${previous.images.length} -> ${current.images.length}`);
    }
    for (const related of previous.relatedProductIds) {
      if (!current.relatedProductIds.includes(related)) problems.push(`LOST related product ${related} on ${id}`);
    }
    for (const compatible of previous.builderCompatibleIds) {
      if (!current.builderCompatibleIds.includes(compatible)) problems.push(`LOST builder compatibility ${compatible} on ${id}`);
    }
  }

  const added = [...afterById.keys()].filter((id) => !beforeById.has(id));

  console.log(`Before: ${before.productCount} products. After: ${after.productCount} products.`);
  if (added.length > 0) console.log(`Added products: ${added.join(", ")}`);

  if (problems.length === 0) {
    console.log("PARITY OK — no product data was removed or altered.");
    return;
  }
  console.error(`PARITY FAILURES (${problems.length}):`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exitCode = 1;
}

const mode = process.argv[2];
if (mode === "compare") compare();
else if (mode === "before" || mode === "after") write(mode);
else {
  console.error("Usage: catalogue-parity-snapshot.ts <before|after|compare>");
  process.exitCode = 1;
}
