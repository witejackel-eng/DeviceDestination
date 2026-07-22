import { existsSync } from "node:fs";
import path from "node:path";
import type { Product } from "@/lib/products";
import { normalizeModel, normaliseSearchTerm } from "@/lib/products";

export type CatalogueValidationReport = {
  productCount: number;
  duplicateIds: string[];
  duplicateSlugs: string[];
  duplicateModels: string[];
  missingAssets: string[];
  modelMismatches: string[];
  brokenRelatedReferences: string[];
  brokenBuilderReferences: string[];
  errors: string[];
  warnings: string[];
};

function duplicates(values: string[]) {
  const seen = new Set<string>();
  const duplicated = new Set<string>();
  for (const value of values) (seen.has(value) ? duplicated : seen).add(value);
  return [...duplicated];
}

export function validateProductCatalogue(
  products: Product[],
  options: { publicRoot?: string; checkAssets?: boolean } = {},
): CatalogueValidationReport {
  const publicRoot = options.publicRoot ?? path.join(process.cwd(), "public");
  const checkAssets = options.checkAssets ?? true;
  const ids = new Set(products.map((product) => product.id));
  const duplicateIds = duplicates(products.map((product) => product.id));
  const duplicateSlugs = duplicates(products.map((product) => product.slug));
  const duplicateModels = duplicates(products.map((product) => normalizeModel(product.model)));
  const missingAssets: string[] = [];
  const modelMismatches: string[] = [];
  const brokenRelatedReferences: string[] = [];
  const brokenBuilderReferences: string[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const product of products) {
    const prefix = `${product.model} (${product.slug})`;
    if (!product.title.trim()) errors.push(`${prefix}: missing title`);
    if (!product.shortDescription.trim()) errors.push(`${prefix}: missing short description`);
    if (!product.longDescription.trim()) errors.push(`${prefix}: missing long description`);
    if (!product.warrantySummary.trim()) errors.push(`${prefix}: missing warranty summary`);
    if (!Object.keys(product.specs).length) errors.push(`${prefix}: missing specifications`);
    if (!product.highlights.length) errors.push(`${prefix}: missing highlights`);
    if (!product.useCases.length) errors.push(`${prefix}: missing use cases`);
    if (!/^https:\/\//.test(product.officialSourceUrl))
      errors.push(`${prefix}: missing official source`);
    if (normaliseSearchTerm(product.slug).includes(normaliseSearchTerm(product.model)) === false)
      modelMismatches.push(`${prefix}: canonical slug does not contain the exact model`);
    if (normalizeModel(product.imageModel) !== normalizeModel(product.model))
      modelMismatches.push(`${prefix}: image association is ${product.imageModel}`);
    for (const document of product.documents) {
      if (normalizeModel(document.model) !== normalizeModel(product.model))
        modelMismatches.push(`${prefix}: ${document.title} is associated to ${document.model}`);
    }
    if (product.priceSourceStatus === "verified" && !product.priceVerifiedAt)
      errors.push(`${prefix}: verified price has no verification date`);
    if (product.priceSourceStatus !== "verified" && product.documents.length === 0)
      warnings.push(`${prefix}: request-price product has no local exact-model document`);
    if (product.sellingPriceInclGstPaise !== null && product.sellingPriceInclGstPaise <= 0)
      errors.push(`${prefix}: invalid selling price`);
    if (
      product.mrpInclGstPaise !== null &&
      product.sellingPriceInclGstPaise !== null &&
      product.sellingPriceInclGstPaise > product.mrpInclGstPaise
    )
      errors.push(`${prefix}: selling price is above MRP`);
    if (!product.gstIncluded) errors.push(`${prefix}: GST inclusion is not explicit`);
    for (const id of product.relatedProductIds)
      if (!ids.has(id)) brokenRelatedReferences.push(`${prefix} → ${id}`);
    for (const id of product.builderCompatibleIds)
      if (!ids.has(id)) brokenBuilderReferences.push(`${prefix} → ${id}`);
    if (checkAssets) {
      for (const asset of [
        ...product.images,
        ...product.documents.map((document) => document.url),
      ]) {
        const localPath = path.join(publicRoot, decodeURIComponent(asset.replace(/^\//, "")));
        if (!existsSync(localPath)) missingAssets.push(`${prefix}: ${asset}`);
      }
    }
  }

  errors.push(
    ...duplicateIds.map((value) => `Duplicate product ID: ${value}`),
    ...duplicateSlugs.map((value) => `Duplicate product slug: ${value}`),
    ...duplicateModels.map((value) => `Duplicate exact model: ${value}`),
    ...missingAssets.map((value) => `Missing asset: ${value}`),
    ...modelMismatches.map((value) => `Model mismatch: ${value}`),
    ...brokenRelatedReferences.map((value) => `Broken related-product reference: ${value}`),
    ...brokenBuilderReferences.map((value) => `Broken builder reference: ${value}`),
  );
  return {
    productCount: products.length,
    duplicateIds,
    duplicateSlugs,
    duplicateModels,
    missingAssets,
    modelMismatches,
    brokenRelatedReferences,
    brokenBuilderReferences,
    errors,
    warnings,
  };
}
