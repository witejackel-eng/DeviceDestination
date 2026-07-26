/**
 * Repository-specific catalogue types (M1).
 *
 * `CatalogueProduct` is a strict superset of the shared public `Product`
 * contract in `@/lib/products`. Adding fields here rather than widening
 * `Product` keeps the browser-facing contract untouched while letting the
 * repository carry the grouped/ordered data the database actually holds.
 *
 * These types are serialisable and may be imported by client code. The
 * database-loading modules (`catalogue-db-adapter.ts`, `repository.ts`) must
 * not be.
 */

import type { Product, ProductDocument } from "@/lib/products";

// ─── Product detail shapes ────────────────────────────────────────────────

export type CatalogueImage = {
  url: string;
  alt: string;
  position: number;
  /** True for the lowest-positioned image. `product_images` has no isPrimary column. */
  isPrimary: boolean;
};

export type CatalogueDocument = ProductDocument & {
  /**
   * Whether an operator confirmed the document belongs to this exact model.
   * Only verified documents reach the public `documents` array.
   */
  modelVerified: boolean;
};

export type CatalogueSpecRow = {
  label: string;
  value: string;
  position: number;
};

export type CatalogueSpecGroup = {
  name: string;
  position: number;
  rows: CatalogueSpecRow[];
};

export type CatalogueCompatibility = {
  /** Public id (slug) of the compatible product, or null for a note-only row. */
  compatibleProductId: string | null;
  note: string | null;
};

export type CatalogueInventory = {
  onHandUnits: number | null;
  reservedUnits: number;
  /** `onHandUnits - reservedUnits`, floored at 0. Null when quantity is untracked. */
  availableUnits: number | null;
  leadTime: string | null;
};

/**
 * Fields on a database-backed product whose value came from the static
 * catalogue rather than the database.
 *
 * `useCases`, `relatedProductIds` and `builderExclusions` have no schema
 * representation at all. `builderCompatibleIds` and `images` do, and are only
 * enriched when the database holds no rows for them.
 */
export type CatalogueEnrichedField =
  | "useCases"
  | "relatedProductIds"
  | "builderExclusions"
  | "builderCompatibleIds"
  | "images";

// ─── Product ──────────────────────────────────────────────────────────────

export type CatalogueProduct = Product & {
  /** Origin of this record. */
  source: CatalogueSourceKind;
  /** `products.id` (uuid) when database-backed, null in static mode. Never the public `id`. */
  databaseId: string | null;
  /** Grouped specifications. The flat `specs` record is derived from this. */
  specGroups: CatalogueSpecGroup[];
  /** Ordered images with alt text and primary semantics. `images` is derived from this. */
  imageDetails: CatalogueImage[];
  /** All documents including unverified ones. `documents` holds only verified entries. */
  documentDetails: CatalogueDocument[];
  /** Raw `product_compatibility` rows, resolved to public ids. */
  compatibility: CatalogueCompatibility[];
  /** Derived stock figures. Never authoritative for `stockStatus`. */
  inventory: CatalogueInventory | null;
  /** Which fields on this product came from static enrichment rather than the database. */
  enrichedFields: CatalogueEnrichedField[];
  /** Precomputed lowercase search corpus. */
  searchText: string;
};

// ─── Snapshot ─────────────────────────────────────────────────────────────

export type CatalogueSourceKind = "database" | "static";

export type CatalogueSourceReason =
  | "database"
  | "database_not_configured"
  | "database_unavailable"
  | "query_failed"
  | "database_empty"
  | "no_published_products"
  | "all_products_invalid";

export type CatalogueDiagnosticCode =
  | "database_not_configured"
  | "database_unavailable"
  | "query_failed"
  | "database_empty"
  | "no_published_products"
  | "product_mapping_failed"
  | "product_excluded"
  | "relation_discarded"
  | "all_products_invalid";

export type CatalogueDiagnostic = {
  code: CatalogueDiagnosticCode;
  /** Safe, non-identifying message. Never contains SQL, credentials or customer data. */
  message: string;
  /** Public product id (slug) when the diagnostic concerns one product. */
  productId?: string;
};

export type CatalogueSnapshot = {
  source: CatalogueSourceKind;
  reason: CatalogueSourceReason;
  products: CatalogueProduct[];
  /** Lookup by canonical slug and by every legacy slug. */
  bySlug: Map<string, CatalogueProduct>;
  diagnostics: CatalogueDiagnostic[];
};

export type CatalogueTaxonomyEntry = {
  slug: string;
  name: string;
  productCount: number;
};

// ─── Database row shapes (adapter contract) ───────────────────────────────

/**
 * Row shapes the repository consumes. Declared structurally rather than
 * inferred from Drizzle so tests can build typed fixtures without a database.
 */

export type CatalogueProductRow = {
  id: string;
  slug: string;
  legacySlugs: string[] | null;
  model: string;
  title: string;
  shortDescription: string;
  longDescription: string | null;
  brandName: string;
  brandSlug: string;
  categoryName: string;
  categorySlug: string;
  status: string;
  stockStatus: string;
  leadTime: string | null;
  sellingPriceInclGstPaise: number | null;
  mrpInclGstPaise: number | null;
  compareAtPriceInclGstPaise: number | null;
  compareAtLabel: string | null;
  gstRateBasisPoints: number;
  gstIncluded: boolean;
  priceSourceStatus: string;
  priceVerifiedAt: Date | null;
  warrantySummary: string | null;
  officialSourceUrl: string;
  verifiedAt: Date;
};

export type CatalogueImageRow = {
  productId: string;
  url: string;
  alt: string;
  position: number;
};

export type CatalogueDocumentRow = {
  id: string;
  productId: string;
  type: string;
  title: string;
  url: string;
  modelVerified: boolean;
};

export type CatalogueSpecRow_Db = {
  productId: string;
  groupName: string | null;
  label: string;
  value: string;
  position: number;
};

export type CatalogueHighlightRow = {
  productId: string;
  text: string;
  position: number;
};

export type CatalogueCompatibilityRow = {
  productId: string;
  compatibleProductId: string | null;
  note: string | null;
};

export type CatalogueInventoryRow = {
  productId: string;
  quantityAvailable: number | null;
  reserved: number;
  leadTime: string | null;
};

export type CatalogueQueryResult = {
  products: CatalogueProductRow[];
  images: CatalogueImageRow[];
  documents: CatalogueDocumentRow[];
  specs: CatalogueSpecRow_Db[];
  highlights: CatalogueHighlightRow[];
  compatibility: CatalogueCompatibilityRow[];
  inventory: CatalogueInventoryRow[];
  /**
   * Total product rows regardless of status. Only populated when `products` is
   * empty, to distinguish an empty database from one with no published rows.
   */
  totalProductCount?: number;
};

/**
 * Injectable database seam. The default implementation talks to Drizzle;
 * tests supply fakes so the whole repository is exercised without PostgreSQL.
 */
export type CatalogueDatabaseAdapter = {
  isConfigured(): boolean;
  loadPublishedCatalogue(): Promise<CatalogueQueryResult>;
};

/** Minimal logging seam so tests can assert on emitted diagnostics. */
export type CatalogueLogger = {
  debug(payload: Record<string, unknown>, message: string): void;
  warn(payload: Record<string, unknown>, message: string): void;
  error(payload: Record<string, unknown>, message: string): void;
};

export type CatalogueRepositoryOptions = {
  adapter?: CatalogueDatabaseAdapter;
  logger?: CatalogueLogger;
  /** Injectable clock, used only for the database-unavailable cooldown. */
  now?: () => number;
  /** How long to stop re-attempting after a connection failure. Default 30s. */
  failureCooldownMs?: number;
};
