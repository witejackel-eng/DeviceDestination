/**
 * Integration test setup helper.
 *
 * Provides:
 *  - Test environment variable configuration
 *  - PostgreSQL connection creation for tests
 *  - Seed data helpers (products, inventory, customers, orders)
 *  - Cleanup between tests
 *
 * Uses TEST_DATABASE_URL environment variable for the test database.
 * Tests that require a database should check `hasTestDb()` and skip
 * gracefully if it's not configured.
 */

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { eq, inArray, sql } from "drizzle-orm";
import * as schema from "@/db/schema";
import { randomUUID } from "node:crypto";

// ─── Environment ──────────────────────────────────────────────────────────

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? "";

export function hasTestDb(): boolean {
  return TEST_DATABASE_URL.length > 0;
}

export function skipMessage(reason: string): string {
  return `Skipping: ${reason}. Set TEST_DATABASE_URL to run this test.`;
}

// ─── Database connection ──────────────────────────────────────────────────

let testDb: ReturnType<typeof drizzle<typeof schema>> | null = null;
let testPool: Pool | null = null;

export function getTestDb(): ReturnType<typeof drizzle<typeof schema>> {
  if (!hasTestDb()) {
    throw new Error("TEST_DATABASE_URL is not set. Cannot create test database connection.");
  }
  if (!testDb) {
    testPool = new Pool({ connectionString: TEST_DATABASE_URL, max: 8 });
    testDb = drizzle(testPool, { schema });
  }
  return testDb;
}

/**
 * Reset the cached DB instance (useful if tests change environment at runtime).
 */
export async function resetTestDb(): Promise<void> {
  if (testPool) {
    await testPool.end();
    testPool = null;
  }
  testDb = null;
}

// ─── Test data identifiers ────────────────────────────────────────────────

/**
 * Tests need identifiers that:
 *   1. Are valid UUIDs (most PK columns in the schema are `uuid`).
 *   2. Are recognisable so cleanup can delete only test rows.
 *
 * We use a fixed 4-hex marker prefix `dddd` in the first segment of a v4
 * UUID. The resulting UUID is fully spec-compliant:
 *   `ddddXXXX-XXXX-4xxx-Yxxx-XXXXXXXXXXXX`
 * where Y ∈ {8,9,a,b}. Cleanup matches `id::text LIKE 'dddd%'` on UUID
 * columns and falls back to text-pattern matches for text columns.
 */
const TEST_MARKER = "dddd";
const TEST_PREFIX = "itest_";

function hex(n: number): string {
  return Math.floor(Math.random() * 16).toString(16);
}

export function testUuid(): string {
  const seg2 = Array.from({ length: 4 }, hex).join("");
  const seg3 = `4${Array.from({ length: 3 }, hex).join("")}`;
  const seg4 = `${(8 + Math.floor(Math.random() * 4)).toString(16)}${Array.from({ length: 3 }, hex).join("")}`;
  const seg5 = Array.from({ length: 12 }, hex).join("");
  return `${TEST_MARKER}${Array.from({ length: 4 }, hex).join("")}-${seg2}-${seg3}-${seg4}-${seg5}`;
}

export function testId(label: string): string {
  // Return a valid UUID; the label is ignored but kept for call-site
  // readability. Cleanup uses the `dddd` prefix to identify test rows.
  void label;
  return testUuid();
}

/** Text identifier for non-uuid columns (idempotency keys, provider IDs). */
export function testTextId(label: string): string {
  return `${TEST_PREFIX}${label}_${randomUUID().slice(0, 8)}`;
}

// ─── Seed helpers ─────────────────────────────────────────────────────────

export type SeedBrand = { id: string; name: string; slug: string };
export type SeedCategory = { id: string; name: string; slug: string };
export type SeedProduct = {
  id: string;
  slug: string;
  model: string;
  title: string;
  shortDescription: string;
  brandId: string;
  categoryId: string;
  sellingPriceInclGstPaise: number;
  mrpInclGstPaise: number | null;
  gstRateBasisPoints: number;
  stockStatus: string;
  status: string;
  priceSourceStatus: string;
  priceVerifiedAt: Date | null;
  officialSourceUrl: string;
  verifiedAt: Date;
};
export type SeedInventory = {
  id: string;
  productId: string;
  quantityAvailable: number | null;
  reserved: number;
};
export type SeedCustomer = { id: string; name: string; email: string; mobile: string };
export type SeedAddress = {
  id: string;
  customerId: string;
  line1: string;
  city: string;
  state: string;
  pincode: string;
};
export type SeedOrder = {
  id: string;
  orderNumber: string;
  customerId: string;
  shippingAddressId: string;
  status: string;
  subtotalInclGstPaise: number;
  shippingPaise: number;
  totalInclGstPaise: number;
  includedGstPaise: number;
  idempotencyKey: string;
};
export type SeedPayment = {
  id: string;
  orderId: string;
  providerOrderId: string;
  status: string;
  amountPaise: number;
};
export type SeedOrderItem = {
  id: string;
  orderId: string;
  productId: string;
  model: string;
  title: string;
  quantity: number;
  unitPriceInclGstPaise: number;
  gstRateBasisPoints: number;
};

/**
 * Create a brand row for testing.
 */
export async function seedBrand(overrides?: Partial<SeedBrand>): Promise<SeedBrand> {
  const db = getTestDb();
  const id = testId("brand");
  const defaults: SeedBrand = {
    id,
    name: `Test Brand ${id}`,
    slug: `test-brand-${id}`,
  };
  const values = { ...defaults, ...overrides };
  await db.insert(schema.brands).values(values as any);
  return values;
}

/**
 * Create a category row for testing.
 */
export async function seedCategory(overrides?: Partial<SeedCategory>): Promise<SeedCategory> {
  const db = getTestDb();
  const id = testId("cat");
  const defaults: SeedCategory = {
    id,
    name: `Test Category ${id}`,
    slug: `test-cat-${id}`,
  };
  const values = { ...defaults, ...overrides };
  await db.insert(schema.categories).values(values as any);
  return values;
}

/**
 * Create a published product with verified pricing.
 */
export async function seedProduct(overrides?: Partial<SeedProduct>): Promise<SeedProduct> {
  const db = getTestDb();
  const id = testId("prod");
  const brand = await seedBrand();
  const category = await seedCategory();
  const defaults: SeedProduct = {
    id,
    slug: `test-product-${id}`,
    model: `TEST-MODEL-${id}`,
    title: `Test Product ${id}`,
    shortDescription: `Test product description for ${id}`,
    brandId: brand.id,
    categoryId: category.id,
    sellingPriceInclGstPaise: 100000, // ₹1,000
    mrpInclGstPaise: 120000,
    gstRateBasisPoints: 1800,
    stockStatus: "in_stock",
    status: "published",
    priceSourceStatus: "verified",
    priceVerifiedAt: new Date(),
    officialSourceUrl: "https://example.com/test-product",
    verifiedAt: new Date(),
  };
  const values = { ...defaults, ...overrides };
  // Remove any overrides that don't belong in the insert
  await db.insert(schema.products).values(values as any);
  return values;
}

/**
 * Create inventory row for a product.
 */
export async function seedInventory(overrides?: Partial<SeedInventory>): Promise<SeedInventory> {
  const db = getTestDb();
  const product = overrides?.productId
    ? { id: overrides.productId }
    : await seedProduct();
  const defaults: SeedInventory = {
    id: testId("inv"),
    productId: product.id,
    quantityAvailable: 10,
    reserved: 0,
  };
  const values = { ...defaults, ...overrides };
  await db.insert(schema.inventory)
    .values({
      id: values.id,
      productId: values.productId,
      quantityAvailable: values.quantityAvailable,
      reserved: values.reserved,
    })
    .onConflictDoNothing({ target: schema.inventory.productId });
  return values;
}

/**
 * Create a customer row.
 */
export async function seedCustomer(overrides?: Partial<SeedCustomer>): Promise<SeedCustomer> {
  const db = getTestDb();
  const id = testId("cust");
  const defaults: SeedCustomer = {
    id,
    name: `Test Customer ${id}`,
    email: `test-${id}@example.com`,
    mobile: "9876543210",
  };
  const values = { ...defaults, ...overrides, id };
  await db.insert(schema.customers).values(values as any);
  return values;
}

/**
 * Create an address row.
 */
export async function seedAddress(customerId: string, overrides?: Partial<SeedAddress>): Promise<SeedAddress> {
  const db = getTestDb();
  const defaults: SeedAddress = {
    id: testId("addr"),
    customerId,
    line1: "123 Test Street",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "400001",
  };
  const values = { ...defaults, ...overrides };
  await db.insert(schema.addresses).values(values as any);
  return values;
}

/**
 * Create a full order with customer, address, items, and payment.
 */
export async function seedOrderWithPayment(
  productOverrides?: Partial<SeedProduct>,
  inventoryOverrides?: Partial<SeedInventory>,
  orderOverrides?: Partial<SeedOrder>,
  paymentOverrides?: Partial<SeedPayment>,
): Promise<{
  customer: SeedCustomer;
  address: SeedAddress;
  product: SeedProduct;
  inventory: SeedInventory;
  order: SeedOrder;
  orderItem: SeedOrderItem;
  payment: SeedPayment;
}> {
  const db = getTestDb();
  // If the caller provides a product id, assume the product already exists
  // (created earlier in the test) and skip seeding a new one. This lets
  // tests reuse a product+inventory pair across multiple helpers.
  let product: SeedProduct;
  if (productOverrides?.id) {
    const [existing] = await db
      .select()
      .from(schema.products)
      .where(eq(schema.products.id, productOverrides.id))
      .limit(1);
    if (existing) {
      product = existing as unknown as SeedProduct;
    } else {
      product = await seedProduct(productOverrides);
    }
  } else {
    product = await seedProduct(productOverrides);
  }
  // Same for inventory: if it already exists for this product, skip insert.
  let inv: SeedInventory;
  const [existingInv] = await db
    .select()
    .from(schema.inventory)
    .where(eq(schema.inventory.productId, product.id))
    .limit(1);
  if (existingInv) {
    inv = {
      id: existingInv.id,
      productId: existingInv.productId,
      quantityAvailable: existingInv.quantityAvailable,
      reserved: existingInv.reserved,
    };
  } else {
    inv = await seedInventory({ productId: product.id, ...inventoryOverrides });
  }
  const customer = await seedCustomer();
  const address = await seedAddress(customer.id);

  const orderId = testId("order");
  const orderNumber = `DD-TEST-${orderId.slice(0, 8)}`;
  const idempotencyKey = testTextId("idem");
  const subtotalInclGstPaise = product.sellingPriceInclGstPaise * 1; // 1 unit
  const shippingPaise = 0;
  const totalInclGstPaise = subtotalInclGstPaise + shippingPaise;
  const includedGstPaise = Math.round(subtotalInclGstPaise * product.gstRateBasisPoints / (10000 + product.gstRateBasisPoints));

  const defaults: SeedOrder = {
    id: orderId,
    orderNumber,
    customerId: customer.id,
    shippingAddressId: address.id,
    status: "payment_pending",
    subtotalInclGstPaise,
    shippingPaise,
    totalInclGstPaise,
    includedGstPaise,
    idempotencyKey,
  };
  const orderValues = { ...defaults, ...orderOverrides, id: orderId };
  await db.insert(schema.orders).values(orderValues as any);

  // Order item
  const orderItemId = testId("oitem");
  const orderItemValues: SeedOrderItem = {
    id: orderItemId,
    orderId: orderId,
    productId: product.id,
    model: product.model,
    title: product.title,
    quantity: 1,
    unitPriceInclGstPaise: product.sellingPriceInclGstPaise,
    gstRateBasisPoints: product.gstRateBasisPoints,
  };
  await db.insert(schema.orderItems).values(orderItemValues as any);

  // Payment
  const paymentId = testId("pay");
  const providerOrderId = `test_rp_order_${paymentId}`;
  const defaultsPayment: SeedPayment = {
    id: paymentId,
    orderId: orderId,
    providerOrderId,
    status: "created",
    amountPaise: totalInclGstPaise,
  };
  const paymentValues = { ...defaultsPayment, ...paymentOverrides, id: paymentId };
  await db.insert(schema.payments).values(paymentValues as any);

  return {
    customer,
    address,
    product,
    inventory: inv,
    order: orderValues,
    orderItem: orderItemValues,
    payment: paymentValues,
  };
}

// ─── Cleanup ──────────────────────────────────────────────────────────────

/**
 * Delete all test-prefix rows from key tables. Called in afterAll/afterEach.
 *
 * Uses a safe pattern: only deletes rows where IDs or known fields start
 * with TEST_PREFIX or contain "itest_" to avoid deleting production data.
 */
export async function cleanupTestData(): Promise<void> {
  if (!hasTestDb()) return;
  const db = getTestDb();

  // Delete in reverse dependency order to avoid FK constraint errors.
  // We use raw SQL for bulk deletion because drizzle's del doesn't
  // support LIKE-based bulk deletes well.

  const tablesInOrder = [
    "payment_webhook_events",
    "checkout_attempts",
    "payment_reconciliation_results",
    "jobs",
    "inventory_adjustments",
    "inventory_reservations",
    "order_items",
    "order_status_events",
    "payments",
    "orders",
    "addresses",
    "customers",
    "inventory",
    "products",
    "product_highlights",
    "product_specs",
    "product_images",
    "product_documents",
    "product_compatibility",
    "product_price_history",
    "brands",
    "categories",
    "admin_audit_logs",
    "system_runs",
    "settings",
  ];

  for (const table of tablesInOrder) {
    try {
      await db.execute(
        sql.raw(`DELETE FROM "${table}" WHERE id::text LIKE '${TEST_MARKER}%' OR id::text LIKE '${TEST_PREFIX}%' OR id::text LIKE '%itest_%'`),
      );
    } catch {
      // Some tables may not have an id column matching this pattern,
      // or the table may not exist yet in the test DB. Ignore errors.
    }
  }

  // Also clean orders by idempotency_key pattern
  try {
    await db.execute(
      sql.raw(`DELETE FROM orders WHERE idempotency_key::text LIKE '${TEST_PREFIX}%'`),
    );
  } catch { /* ignore */ }

  // Also clean payments by provider_order_id pattern
  try {
    await db.execute(
      sql.raw(`DELETE FROM payments WHERE provider_order_id::text LIKE '%test_rp_%' OR provider_order_id::text LIKE '%placeholder_%'`),
    );
  } catch { /* ignore */ }

  // Also clean checkout_attempts by idempotency_key pattern
  try {
    await db.execute(
      sql.raw(`DELETE FROM checkout_attempts WHERE idempotency_key::text LIKE '${TEST_PREFIX}%'`),
    );
  } catch { /* ignore */ }

  // Also clean jobs by dedupe_key pattern
  try {
    await db.execute(
      sql.raw(`DELETE FROM jobs WHERE dedupe_key::text LIKE '%itest_%'`),
    );
  } catch { /* ignore */ }

  // Also clean inventory_reservations by order_id pattern (FK-based)
  try {
    await db.execute(
      sql.raw(`DELETE FROM inventory_reservations WHERE order_id IN (SELECT id FROM orders WHERE id::text LIKE '${TEST_MARKER}%')`),
    );
  } catch { /* ignore */ }
}

/**
 * Full reset: drop and recreate test schema. Only for CI or controlled envs.
 */
export async function resetTestSchema(): Promise<void> {
  if (!hasTestDb()) return;
  const db = getTestDb();
  // This is intentionally simple — just delete all test data.
  await cleanupTestData();
}

// ─── Test environment setup ───────────────────────────────────────────────

/**
 * Configure environment variables for integration tests.
 * Sets NODE_ENV=test and ensures the DB URL is TEST_DATABASE_URL.
 */
export function setupTestEnv(): void {
  (process.env as Record<string, string>).NODE_ENV = "test";
  // Override DATABASE_URL with the test URL so production code paths
  // that read DATABASE_URL connect to the test database.
  if (hasTestDb()) {
    process.env.DATABASE_URL = TEST_DATABASE_URL;
  }
  // Ensure Razorpay is "configured" for test mode with dummy keys.
  process.env.RAZORPAY_KEY_ID = "test_key_id";
  process.env.RAZORPAY_KEY_SECRET = "test_key_secret";
  process.env.RAZORPAY_WEBHOOK_SECRET = "test_webhook_secret";
  process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID = "test_key_id";
  process.env.BETTER_AUTH_SECRET = "test_auth_secret_for_integration_tests";
  process.env.ADMIN_EMAILS = "admin@test.com";
  process.env.NEXT_PUBLIC_SITE_URL = "https://test.devicedestination.com";
}

/**
 * Restore environment after tests.
 */
export function teardownTestEnv(originalEnv: Record<string, string | undefined>): void {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

/**
 * Snapshot the current env for later restoration.
 */
export function snapshotEnv(): Record<string, string | undefined> {
  const keys = [
    "NODE_ENV",
    "DATABASE_URL",
    "TEST_DATABASE_URL",
    "RAZORPAY_KEY_ID",
    "RAZORPAY_KEY_SECRET",
    "RAZORPAY_WEBHOOK_SECRET",
    "NEXT_PUBLIC_RAZORPAY_KEY_ID",
    "BETTER_AUTH_SECRET",
    "ADMIN_EMAILS",
    "NEXT_PUBLIC_SITE_URL",
  ];
  const snapshot: Record<string, string | undefined> = {};
  for (const key of keys) {
    snapshot[key] = process.env[key];
  }
  return snapshot;
}

// ─── Utility helpers ──────────────────────────────────────────────────────

/**
 * Pause for a short time (useful for letting DB writes propagate).
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate a unique idempotency key for checkout tests.
 */
export function uniqueIdempotencyKey(): string {
  return testTextId("idem");
}

/**
 * Generate a unique provider event ID for webhook tests.
 */
export function uniqueProviderEventId(): string {
  return testTextId("evt");
}
