import { existsSync } from "node:fs";
import path from "node:path";
import { catalogue } from "../src/data/catalog";
import { normalizeModel } from "../src/lib/products";

const errors: string[] = [];
const models = new Set<string>();
const slugs = new Set<string>();

for (const product of catalogue) {
  const model = normalizeModel(product.model);
  if (models.has(model)) errors.push(`Duplicate model: ${product.model}`);
  if (slugs.has(product.slug)) errors.push(`Duplicate slug: ${product.slug}`);
  models.add(model);
  slugs.add(product.slug);
  if (!product.title.trim()) errors.push(`${product.model}: missing title`);
  if (!/^https:\/\//.test(product.officialSourceUrl))
    errors.push(`${product.model}: missing official source`);
  if (product.sellingPriceInclGstPaise !== null && product.sellingPriceInclGstPaise <= 0)
    errors.push(`${product.model}: invalid selling price`);
  if (
    product.mrpInclGstPaise !== null &&
    product.sellingPriceInclGstPaise !== null &&
    product.sellingPriceInclGstPaise > product.mrpInclGstPaise
  )
    errors.push(`${product.model}: selling price above MRP`);
  if (!product.gstIncluded) errors.push(`${product.model}: GST status missing`);
  if (!model || model.length < 2) errors.push(`${product.slug}: published without an exact model`);
  for (const asset of [...product.images, ...product.documents.map((document) => document.url)]) {
    const localPath = path.join(
      process.cwd(),
      "public",
      decodeURIComponent(asset.replace(/^\//, "")),
    );
    if (!existsSync(localPath)) errors.push(`${product.model}: dead asset ${asset}`);
  }
}

if (errors.length) {
  console.error(`Product validation failed with ${errors.length} issue(s):`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}
console.log(
  `Validated ${catalogue.length} products, ${models.size} exact models, and all public asset paths.`,
);
