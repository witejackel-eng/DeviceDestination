export type ProductDocument = {
  type: "datasheet" | "manual" | "installation-guide";
  title: string;
  url: string;
  model: string;
};

export type Product = {
  id: string;
  slug: string;
  legacySlugs: string[];
  model: string;
  brand: string;
  brandSlug: string;
  category: string;
  categorySlug: string;
  title: string;
  shortDescription: string;
  longDescription: string;
  images: string[];
  imageModel: string;
  documents: ProductDocument[];
  specs: Record<string, string>;
  highlights: string[];
  useCases: string[];
  stockStatus: "in_stock" | "limited" | "lead_time" | "quote_only";
  sellingPriceInclGstPaise: number | null;
  mrpInclGstPaise: number | null;
  compareAtPriceInclGstPaise: number | null;
  compareAtLabel: "MRP" | "Typical online price" | "Regular price" | null;
  gstRateBasisPoints: number;
  gstIncluded: true;
  priceVerifiedAt: string | null;
  priceSourceStatus: "verified" | "needs-review" | "request-price";
  officialSourceUrl: string;
  verifiedAt: string;
  warrantySummary: string;
  relatedProductIds: string[];
  builderCompatibleIds: string[];
  builderExclusions: string[];
};

export function normalizeModel(model: string) {
  return model
    .trim()
    .toUpperCase()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-");
}

export function normaliseSearchTerm(value: string) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export type PurchaseEligibility =
  | { eligible: true; reason: null }
  | {
      eligible: false;
      reason: "request_price" | "out_of_stock" | "missing_price" | "stale_price";
    };

export function getPurchaseEligibility(
  product: Pick<
    Product,
    "stockStatus" | "sellingPriceInclGstPaise" | "priceSourceStatus" | "priceVerifiedAt"
  >,
  options: { now?: Date; maxAgeDays?: number } = {},
): PurchaseEligibility {
  if (product.stockStatus === "quote_only" || product.priceSourceStatus !== "verified")
    return { eligible: false, reason: "request_price" };
  if (product.stockStatus === "lead_time") return { eligible: false, reason: "out_of_stock" };
  if (product.sellingPriceInclGstPaise === null)
    return { eligible: false, reason: "missing_price" };
  if (!product.priceVerifiedAt) return { eligible: false, reason: "stale_price" };
  const now = options.now ?? new Date();
  const maxAgeDays = options.maxAgeDays ?? 30;
  const ageMs = now.getTime() - new Date(product.priceVerifiedAt).getTime();
  if (!Number.isFinite(ageMs) || ageMs > maxAgeDays * 86_400_000)
    return { eligible: false, reason: "stale_price" };
  return { eligible: true, reason: null };
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/\+/g, "-plus")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function formatPrice(paise: number | null) {
  if (paise === null) return "Request a quote";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: paise % 100 === 0 ? 0 : 2,
  }).format(paise / 100);
}

export function calculateDiscountPercent(sellingPaise: number, compareAtPaise: number | null) {
  if (!compareAtPaise || compareAtPaise <= sellingPaise) return null;
  return Math.round(((compareAtPaise - sellingPaise) / compareAtPaise) * 100);
}

export function extractIncludedGst(totalInclGstPaise: number, gstRateBasisPoints: number) {
  return Math.round(totalInclGstPaise - (totalInclGstPaise * 10000) / (10000 + gstRateBasisPoints));
}

export function calculateCartTotals(items: Array<{ product: Product; quantity: number }>) {
  const subtotalInclGstPaise = items.reduce((sum, item) => {
    const price = item.product.sellingPriceInclGstPaise ?? 0;
    return sum + price * item.quantity;
  }, 0);
  const includedGstPaise = items.reduce((sum, item) => {
    const price = item.product.sellingPriceInclGstPaise ?? 0;
    return sum + extractIncludedGst(price * item.quantity, item.product.gstRateBasisPoints);
  }, 0);
  return {
    subtotalInclGstPaise,
    shippingPaise: 0,
    installationPaise: null,
    includedGstPaise,
    grandTotalInclGstPaise: subtotalInclGstPaise,
  };
}
