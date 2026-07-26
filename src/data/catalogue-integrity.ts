/**
 * Typed integrity boundary for repository output (M1).
 *
 * Two severities, deliberately separated:
 *
 *  - **Fatal** — identity or classification is unusable, so the product cannot
 *    be represented at all. Only that product is excluded; the catalogue keeps
 *    working.
 *  - **Repairable** — an optional field is malformed. The field is discarded or
 *    normalised, a diagnostic is emitted, and the product survives.
 *
 * No rule here fabricates data. A missing or corrupt price stays explicitly
 * `null` so the M5 pricing policy can decide what it means; M1 does not.
 */

import type { Product } from "@/lib/products";
import type { CatalogueDiagnostic } from "@/data/catalogue-types";

// ─── Value normalisers ────────────────────────────────────────────────────

const STOCK_STATUSES: readonly Product["stockStatus"][] = [
  "in_stock",
  "limited",
  "lead_time",
  "quote_only",
];

const COMPARE_AT_LABELS: readonly NonNullable<Product["compareAtLabel"]>[] = [
  "MRP",
  "Typical online price",
  "Regular price",
];

/**
 * The database enum is snake_case (`needs_review`), the public contract is
 * kebab-case (`needs-review`). The previous repository cast between them
 * unchecked, emitting values no consumer handles.
 */
const PRICE_SOURCE_STATUSES: Record<string, Product["priceSourceStatus"]> = {
  verified: "verified",
  needs_review: "needs-review",
  "needs-review": "needs-review",
  request_price: "request-price",
  "request-price": "request-price",
};

export function normalisePriceSourceStatus(value: string): Product["priceSourceStatus"] | null {
  return PRICE_SOURCE_STATUSES[value] ?? null;
}

export function normaliseStockStatus(value: string): Product["stockStatus"] | null {
  return STOCK_STATUSES.find((status) => status === value) ?? null;
}

export function normaliseCompareAtLabel(value: string | null): Product["compareAtLabel"] | null {
  if (value === null) return null;
  return COMPARE_AT_LABELS.find((label) => label === value) ?? null;
}

/** True for a value that can be presented as a price in paise. */
export function isValidPricePaise(value: number | null): value is number {
  return value !== null && Number.isSafeInteger(value) && value >= 0;
}

export function isNonEmpty(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

// ─── Fatal identity checks ────────────────────────────────────────────────

export type IdentityCandidate = {
  slug: string | null | undefined;
  model: string | null | undefined;
  title: string | null | undefined;
  brandName: string | null | undefined;
  brandSlug: string | null | undefined;
  categoryName: string | null | undefined;
  categorySlug: string | null | undefined;
  stockStatus: string;
  priceSourceStatus: string;
  gstIncluded: boolean;
  gstRateBasisPoints: number;
};

/**
 * Reasons a published row cannot become a catalogue product.
 * Returns an empty array when the product is usable.
 */
export function findFatalIdentityDefects(candidate: IdentityCandidate): string[] {
  const defects: string[] = [];
  if (!isNonEmpty(candidate.slug)) defects.push("missing slug");
  if (!isNonEmpty(candidate.model)) defects.push("missing model");
  if (!isNonEmpty(candidate.title)) defects.push("missing title");
  if (!isNonEmpty(candidate.brandName) || !isNonEmpty(candidate.brandSlug))
    defects.push("missing brand");
  if (!isNonEmpty(candidate.categoryName) || !isNonEmpty(candidate.categorySlug))
    defects.push("missing category");
  if (normaliseStockStatus(candidate.stockStatus) === null)
    defects.push("unrecognised stock status");
  if (normalisePriceSourceStatus(candidate.priceSourceStatus) === null)
    defects.push("unrecognised price source status");
  if (candidate.gstIncluded !== true) defects.push("GST inclusion is not explicit");
  if (!Number.isSafeInteger(candidate.gstRateBasisPoints) || candidate.gstRateBasisPoints < 0)
    defects.push("invalid GST rate");
  return defects;
}

// ─── Relation repair ──────────────────────────────────────────────────────

/**
 * Filter a relation list to references that exist in the catalogue, removing
 * self-references and duplicates while preserving first-valid order.
 */
export function resolveRelationIds(
  ids: readonly string[],
  options: { selfId: string; knownIds: ReadonlySet<string> },
): { resolved: string[]; discarded: string[] } {
  const resolved: string[] = [];
  const discarded: string[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    if (!isNonEmpty(id)) {
      discarded.push(String(id));
      continue;
    }
    if (id === options.selfId) {
      discarded.push(id);
      continue;
    }
    if (!options.knownIds.has(id)) {
      discarded.push(id);
      continue;
    }
    if (seen.has(id)) continue;
    seen.add(id);
    resolved.push(id);
  }
  return { resolved, discarded };
}

export function relationDiagnostic(
  productId: string,
  relation: string,
  discarded: readonly string[],
): CatalogueDiagnostic {
  return {
    code: "relation_discarded",
    productId,
    message: `${relation}: discarded ${discarded.length} unresolvable reference(s)`,
  };
}
