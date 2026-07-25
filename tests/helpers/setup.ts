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

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
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

export function getTestDb(): ReturnType<typeof drizzle<typeof schema>> {
  if (!hasTestDb()) {
    throw new Error("TEST_DATABASE_URL is not set. Cannot create test database connection.");
  }
  if (!testDb) {
    testDb = drizzle(neon(TEST_DATABASE_URL), { schema });
  }
  return testDb;
}

/**
 * Reset the cached DB instance (useful if tests change environment at runtime).
 */
export function resetTestDb(): void {
  testDb = null;
}

// ─── Test data identifiers ────────────────────────────────────────────────

const TEST_PREFIX = "itest_";

export function testId(label: string): string {
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
  await db.insert(schema.brands).values(values as typeof schema.brands.$inferInsert);
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
  await db.insert(schema.categories).values(values as typeof schema.categories.$inferInsert);
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
  const values = { ...defaults, ...overrides, id };
  // Remove any overrides that don't belong in the insert
  await db.insert(schema.products).values(values as typeof schema.products.$inferInsert);
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
  await db.insert(schema.inventory).values({
    id: values.id,
    productId: values.productId,
    quantityAvailable: values.quantityAvailable,
    reserved: values.reserved,
  });
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
  await db.insert(schema.customers).values(values as typeof schema.customers.$inferInsert);
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
  await db.insert(schema.addresses).values(values as typeof schema.addresses.$inferInsert);
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
  const product = await seedProduct(productOverrides);
  const inv = await seedInventory({ productId: product.id, ...inventoryOverrides });
  const customer = await seedCustomer();
  const address = await seedAddress(customer.id);

  const orderId = testId("order");
  const orderNumber = `DD-TEST-${orderId.slice(0, 8)}`;
  const idempotencyKey = testId("idem");
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
  await db.insert(schema.orders).values(orderValues as typeof schema.orders.$inferInsert);

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
  await db.insert(schema.orderItems).values(orderItemValues as typeof schema.orderItems.$inferInsert);

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
  await db.insert(schema.payments).values(paymentValues as typeof schema.payments.$inferInsert);

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
        sql.raw(`DELETE FROM "${table}" WHERE id::text LIKE '${TEST_PREFIX}%' OR id::text LIKE '%itest_%'`),
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
      sql.raw(`DELETE FROM inventory_reservations WHERE order_id IN (SELECT id FROM orders WHERE id::text LIKE '${TEST_PREFIX}%')`),
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
  return testId("idem");
}

/**
 * Generate a unique provider event ID for webhook tests.
 */
export function uniqueProviderEventId(): string {
  return testId("evt");
}
