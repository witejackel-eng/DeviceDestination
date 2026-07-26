/**
 * Database row → `CatalogueProduct` mapping (M1).
 *
 * Two passes. The first turns each published row into a product without
 * resolving relations; the second resolves relations once the full set of
 * usable public ids is known, so a reference to a draft or excluded product is
 * filtered rather than left dangling.
 *
 * Ordering is re-applied here rather than trusted from SQL, so an adapter that
 * returns rows in arbitrary order still produces a deterministic catalogue.
 */

import type {
  CatalogueCompatibility,
  CatalogueDiagnostic,
  CatalogueDocument,
  CatalogueDocumentRow,
  CatalogueEnrichedField,
  CatalogueHighlightRow,
  CatalogueImage,
  CatalogueImageRow,
  CatalogueInventory,
  CatalogueInventoryRow,
  CatalogueProduct,
  CatalogueProductRow,
  CatalogueQueryResult,
  CatalogueSpecGroup,
  CatalogueSpecRow_Db,
} from "@/data/catalogue-types";
import {
  DEFAULT_SPEC_GROUP,
  PLACEHOLDER_IMAGE_URL,
  buildSearchText,
  getEnrichment,
} from "@/data/catalogue-static";
import {
  findFatalIdentityDefects,
  isNonEmpty,
  isValidPricePaise,
  normaliseCompareAtLabel,
  normalisePriceSourceStatus,
  normaliseStockStatus,
  relationDiagnostic,
  resolveRelationIds,
} from "@/data/catalogue-integrity";

const DEFAULT_WARRANTY = "OEM warranty terms apply";
const DOCUMENT_TYPES: readonly CatalogueDocument["type"][] = [
  "datasheet",
  "manual",
  "installation-guide",
];

function groupByProduct<T extends { productId: string }>(rows: readonly T[]): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const existing = grouped.get(row.productId);
    if (existing) existing.push(row);
    else grouped.set(row.productId, [row]);
  }
  return grouped;
}

function toIso(value: Date | null): string | null {
  if (!(value instanceof Date)) return null;
  const time = value.getTime();
  return Number.isFinite(time) ? value.toISOString() : null;
}

// ─── Child collection mapping ─────────────────────────────────────────────

function mapImages(rows: readonly CatalogueImageRow[]): CatalogueImage[] {
  return rows
    .filter((row) => isNonEmpty(row.url))
    .slice()
    .sort((a, b) => a.position - b.position || a.url.localeCompare(b.url))
    .map((row, index) => ({
      url: row.url,
      alt: isNonEmpty(row.alt) ? row.alt : "",
      position: row.position,
      isPrimary: index === 0,
    }));
}

/**
 * `product_documents` has no position column, so order is derived from stable
 * columns instead: type, then title, then id.
 */
function mapDocuments(rows: readonly CatalogueDocumentRow[], model: string): CatalogueDocument[] {
  return rows
    .filter((row) => isNonEmpty(row.url) && isNonEmpty(row.title))
    .slice()
    .sort(
      (a, b) =>
        a.type.localeCompare(b.type) || a.title.localeCompare(b.title) || a.id.localeCompare(b.id),
    )
    .map((row) => ({
      type: DOCUMENT_TYPES.find((type) => type === row.type) ?? "datasheet",
      title: row.title,
      url: row.url,
      model,
      modelVerified: row.modelVerified === true,
    }));
}

/**
 * `product_specs` has no group-position column, so group order is derived from
 * the lowest row position in each group, tiebroken alphabetically.
 */
function mapSpecGroups(rows: readonly CatalogueSpecRow_Db[]): CatalogueSpecGroup[] {
  const groups = new Map<string, { rows: CatalogueSpecRow_Db[]; minPosition: number }>();
  for (const row of rows) {
    if (!isNonEmpty(row.label)) continue;
    const name = isNonEmpty(row.groupName) ? row.groupName : DEFAULT_SPEC_GROUP;
    const existing = groups.get(name);
    if (existing) {
      existing.rows.push(row);
      existing.minPosition = Math.min(existing.minPosition, row.position);
    } else {
      groups.set(name, { rows: [row], minPosition: row.position });
    }
  }
  return [...groups.entries()]
    .sort((a, b) => a[1].minPosition - b[1].minPosition || a[0].localeCompare(b[0]))
    .map(([name, group], index) => ({
      name,
      position: index,
      rows: group.rows
        .slice()
        .sort((a, b) => a.position - b.position || a.label.localeCompare(b.label))
        .map((row) => ({ label: row.label, value: row.value, position: row.position })),
    }));
}

/**
 * Flatten groups into the public `specs` record. Groups are visited in order
 * and the first occurrence of a label wins, so the flat view stays stable when
 * two groups share a label. `specGroups` retains the full structure.
 */
function flattenSpecs(groups: readonly CatalogueSpecGroup[]): Record<string, string> {
  const specs: Record<string, string> = {};
  for (const group of groups) {
    for (const row of group.rows) {
      if (!(row.label in specs)) specs[row.label] = row.value;
    }
  }
  return specs;
}

function mapHighlights(rows: readonly CatalogueHighlightRow[]): string[] {
  return rows
    .filter((row) => isNonEmpty(row.text))
    .slice()
    .sort((a, b) => a.position - b.position || a.text.localeCompare(b.text))
    .map((row) => row.text);
}

function mapInventory(
  row: CatalogueInventoryRow | undefined,
  fallbackLeadTime: string | null,
): CatalogueInventory | null {
  if (!row) return null;
  const onHandUnits = Number.isSafeInteger(row.quantityAvailable ?? NaN)
    ? row.quantityAvailable
    : null;
  const reservedUnits = Number.isSafeInteger(row.reserved) && row.reserved >= 0 ? row.reserved : 0;
  return {
    onHandUnits,
    reservedUnits,
    availableUnits: onHandUnits === null ? null : Math.max(0, onHandUnits - reservedUnits),
    leadTime: row.leadTime ?? fallbackLeadTime,
  };
}

function mapLegacySlugs(values: string[] | null, canonicalSlug: string): string[] {
  if (!values) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (!isNonEmpty(value) || value === canonicalSlug || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

// ─── Product mapping ──────────────────────────────────────────────────────

type ProductDraft = {
  product: CatalogueProduct;
  /** Relation candidates, resolved in pass two against the final id set. */
  relatedCandidates: string[];
  builderCandidates: string[];
};

function mapProductRow(
  row: CatalogueProductRow,
  collections: {
    images: CatalogueImageRow[];
    documents: CatalogueDocumentRow[];
    specs: CatalogueSpecRow_Db[];
    highlights: CatalogueHighlightRow[];
    compatibility: Array<{ compatibleProductId: string | null; note: string | null }>;
    inventory: CatalogueInventoryRow | undefined;
  },
  diagnostics: CatalogueDiagnostic[],
): ProductDraft | null {
  const defects = findFatalIdentityDefects({
    slug: row.slug,
    model: row.model,
    title: row.title,
    brandName: row.brandName,
    brandSlug: row.brandSlug,
    categoryName: row.categoryName,
    categorySlug: row.categorySlug,
    stockStatus: row.stockStatus,
    priceSourceStatus: row.priceSourceStatus,
    gstIncluded: row.gstIncluded,
    gstRateBasisPoints: row.gstRateBasisPoints,
  });

  const verifiedAt = toIso(row.verifiedAt);
  const stockStatus = normaliseStockStatus(row.stockStatus);
  const priceSourceStatus = normalisePriceSourceStatus(row.priceSourceStatus);
  if (verifiedAt === null) defects.push("missing verification date");
  if (!isNonEmpty(row.shortDescription)) defects.push("missing short description");
  if (!isNonEmpty(row.officialSourceUrl)) defects.push("missing official source");

  // The null comparisons repeat checks already inside `defects`; they are what
  // narrows the values for the mapping below.
  if (
    defects.length > 0 ||
    verifiedAt === null ||
    stockStatus === null ||
    priceSourceStatus === null ||
    !isNonEmpty(row.slug) ||
    !isNonEmpty(row.model)
  ) {
    diagnostics.push({
      code: "product_excluded",
      productId: isNonEmpty(row.slug) ? row.slug : undefined,
      message: `excluded from database catalogue: ${defects.join(", ")}`,
    });
    return null;
  }

  const slug = row.slug;
  const model = row.model;
  const enrichment = getEnrichment(slug);
  const enrichedFields: CatalogueEnrichedField[] = [];

  // ── Prices — never fabricated, only discarded when structurally invalid ──
  const sellingPriceInclGstPaise = isValidPricePaise(row.sellingPriceInclGstPaise)
    ? row.sellingPriceInclGstPaise
    : null;
  if (row.sellingPriceInclGstPaise !== null && sellingPriceInclGstPaise === null) {
    diagnostics.push({
      code: "product_mapping_failed",
      productId: slug,
      message: "discarded structurally invalid selling price",
    });
  }
  const mrpInclGstPaise = isValidPricePaise(row.mrpInclGstPaise) ? row.mrpInclGstPaise : null;

  // A compare-at price without a recognised label would misrepresent the saving,
  // so an unrecognised label discards both halves of the pair.
  const compareAtLabel = normaliseCompareAtLabel(row.compareAtLabel);
  const compareAtLabelCorrupt = row.compareAtLabel !== null && compareAtLabel === null;
  const compareAtPriceInclGstPaise =
    compareAtLabelCorrupt || !isValidPricePaise(row.compareAtPriceInclGstPaise)
      ? null
      : row.compareAtPriceInclGstPaise;
  if (compareAtLabelCorrupt) {
    diagnostics.push({
      code: "product_mapping_failed",
      productId: slug,
      message: "discarded compare-at pair with an unrecognised label",
    });
  }

  // ── Images — database, then static counterpart, then placeholder ────────
  let imageDetails = mapImages(collections.images);
  if (imageDetails.length === 0 && enrichment.images.length > 0) {
    imageDetails = enrichment.images.map((url, index) => ({
      url,
      alt: `${row.title} — view ${index + 1}`,
      position: index,
      isPrimary: index === 0,
    }));
    enrichedFields.push("images");
  }
  if (imageDetails.length === 0) {
    imageDetails = [{ url: PLACEHOLDER_IMAGE_URL, alt: row.title, position: 0, isPrimary: true }];
    diagnostics.push({
      code: "relation_discarded",
      productId: slug,
      message: "no product image available; using placeholder",
    });
  }

  const documentDetails = mapDocuments(collections.documents, model);
  const specGroups = mapSpecGroups(collections.specs);
  const specs = flattenSpecs(specGroups);
  const highlights = mapHighlights(collections.highlights);

  // ── Compatibility — database when present, static enrichment otherwise ──
  const compatibility: CatalogueCompatibility[] = collections.compatibility
    .slice()
    .sort((a, b) => (a.compatibleProductId ?? "").localeCompare(b.compatibleProductId ?? ""));
  const databaseBuilderIds = compatibility
    .map((entry) => entry.compatibleProductId)
    .filter((id): id is string => isNonEmpty(id));
  let builderCandidates = databaseBuilderIds;
  if (builderCandidates.length === 0 && enrichment.builderCompatibleIds.length > 0) {
    builderCandidates = enrichment.builderCompatibleIds;
    enrichedFields.push("builderCompatibleIds");
  }

  if (enrichment.useCases.length > 0) enrichedFields.push("useCases");
  if (enrichment.relatedProductIds.length > 0) enrichedFields.push("relatedProductIds");
  if (enrichment.builderExclusions.length > 0) enrichedFields.push("builderExclusions");

  const product: CatalogueProduct = {
    // The public id is the slug, never the uuid: the cart stores this value and
    // `checkout-orchestrator` resolves it against `products.slug`.
    id: slug,
    slug,
    legacySlugs: mapLegacySlugs(row.legacySlugs, slug),
    model,
    brand: row.brandName,
    brandSlug: row.brandSlug,
    category: row.categoryName,
    categorySlug: row.categorySlug,
    title: row.title,
    shortDescription: row.shortDescription,
    longDescription: isNonEmpty(row.longDescription) ? row.longDescription : row.shortDescription,
    images: imageDetails.map((image) => image.url),
    imageModel: model,
    documents: documentDetails
      .filter((document) => document.modelVerified)
      .map(({ type, title, url, model: documentModel }) => ({
        type,
        title,
        url,
        model: documentModel,
      })),
    specs,
    highlights,
    useCases: enrichment.useCases,
    stockStatus,
    sellingPriceInclGstPaise,
    mrpInclGstPaise,
    compareAtPriceInclGstPaise,
    compareAtLabel,
    gstRateBasisPoints: row.gstRateBasisPoints,
    gstIncluded: true,
    priceVerifiedAt: toIso(row.priceVerifiedAt),
    priceSourceStatus,
    officialSourceUrl: row.officialSourceUrl,
    verifiedAt,
    warrantySummary: isNonEmpty(row.warrantySummary) ? row.warrantySummary : DEFAULT_WARRANTY,
    relatedProductIds: [],
    builderCompatibleIds: [],
    builderExclusions: enrichment.builderExclusions,
    source: "database",
    databaseId: row.id,
    specGroups,
    imageDetails,
    documentDetails,
    compatibility,
    inventory: mapInventory(collections.inventory, row.leadTime),
    enrichedFields,
    searchText: "",
  };

  return {
    product,
    relatedCandidates: enrichment.relatedProductIds,
    builderCandidates,
  };
}

// ─── Catalogue mapping ────────────────────────────────────────────────────

export function mapDatabaseCatalogue(result: CatalogueQueryResult): {
  products: CatalogueProduct[];
  diagnostics: CatalogueDiagnostic[];
} {
  const diagnostics: CatalogueDiagnostic[] = [];

  const imagesByProduct = groupByProduct(result.images);
  const documentsByProduct = groupByProduct(result.documents);
  const specsByProduct = groupByProduct(result.specs);
  const highlightsByProduct = groupByProduct(result.highlights);
  const compatibilityByProduct = groupByProduct(result.compatibility);
  const inventoryByProduct = new Map(result.inventory.map((row) => [row.productId, row]));

  // Compatibility rows reference products by uuid; the public contract uses slugs.
  const slugByDatabaseId = new Map<string, string>();
  for (const row of result.products) {
    if (isNonEmpty(row.slug)) slugByDatabaseId.set(row.id, row.slug);
  }

  const drafts: ProductDraft[] = [];
  for (const row of result.products) {
    const compatibility = (compatibilityByProduct.get(row.id) ?? []).map((entry) => ({
      compatibleProductId: entry.compatibleProductId
        ? (slugByDatabaseId.get(entry.compatibleProductId) ?? null)
        : null,
      note: entry.note,
    }));
    const draft = mapProductRow(
      row,
      {
        images: imagesByProduct.get(row.id) ?? [],
        documents: documentsByProduct.get(row.id) ?? [],
        specs: specsByProduct.get(row.id) ?? [],
        highlights: highlightsByProduct.get(row.id) ?? [],
        compatibility,
        inventory: inventoryByProduct.get(row.id),
      },
      diagnostics,
    );
    if (draft) drafts.push(draft);
  }

  // Pass two — relations can only be resolved once every usable id is known.
  const knownIds = new Set(drafts.map((draft) => draft.product.id));
  for (const draft of drafts) {
    const { product } = draft;

    const related = resolveRelationIds(draft.relatedCandidates, {
      selfId: product.id,
      knownIds,
    });
    product.relatedProductIds = related.resolved;
    if (related.discarded.length > 0)
      diagnostics.push(relationDiagnostic(product.id, "relatedProductIds", related.discarded));

    const builder = resolveRelationIds(draft.builderCandidates, {
      selfId: product.id,
      knownIds,
    });
    product.builderCompatibleIds = builder.resolved;
    if (builder.discarded.length > 0)
      diagnostics.push(relationDiagnostic(product.id, "builderCompatibleIds", builder.discarded));

    product.compatibility = product.compatibility.filter(
      (entry) =>
        entry.compatibleProductId === null ||
        (entry.compatibleProductId !== product.id && knownIds.has(entry.compatibleProductId)),
    );

    product.searchText = buildSearchText(product);
  }

  return { products: drafts.map((draft) => draft.product), diagnostics };
}
