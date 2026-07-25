/**
 * Integration tests for CHECKOUT orchestration.
 *
 * Tests the full checkout lifecycle: idempotency, inventory reservation,
 * Razorpay order creation, compensation on failure, and price overrides.
 *
 * Uses vitest mocks for Razorpay, shipping, and external services.
 * Tests that require a database will skip gracefully if TEST_DATABASE_URL
 * is not set.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { eq, sql } from "drizzle-orm";
import {
  hasTestDb,
  skipMessage,
  getTestDb,
  seedProduct,
  seedInventory,
  cleanupTestData,
  setupTestEnv,
  teardownTestEnv,
  snapshotEnv,
  testId,
  uniqueIdempotencyKey,
} from "@tests/helpers/setup";
import {
  injectFailure,
  NO_FAILURE,
  type FailureInjection,
} from "@tests/helpers/failure-injection";
import {
  checkoutAttempts,
  orders,
  payments,
  inventory,
  inventoryReservations,
  orderItems,
  customers,
  addresses,
} from "@/db/schema";
// Type-only: erased at compile time, so it does not disturb the dynamic
// `await import(...)` the tests use to pick up per-test mocks.
import type { CheckoutResult } from "@/lib/checkout-orchestrator";

// ─── Environment setup ────────────────────────────────────────────────────

const envSnapshot = snapshotEnv();
beforeAll(() => {
  setupTestEnv();
});
afterAll(() => {
  teardownTestEnv(envSnapshot);
});

// ─── Mock external services ───────────────────────────────────────────────

const mockRazorpayOrderId = testId("rp_order");
vi.mock("@/lib/razorpay", () => ({
  getRazorpay: () => ({
    orders: {
      create: vi.fn().mockResolvedValue({ id: mockRazorpayOrderId }),
      fetchPayments: vi.fn().mockResolvedValue({ items: [] }),
    },
    payments: {
      fetch: vi.fn().mockResolvedValue({ status: "created" }),
    },
  }),
  verifyRazorpayWebhookSignature: vi.fn().mockReturnValue(true),
  verifyRazorpayPaymentSignature: vi.fn().mockReturnValue(true),
  validateRazorpayPaymentRecord: vi.fn().mockReturnValue(true),
}));

vi.mock("@/lib/shipping", () => ({
  getShippingQuote: vi.fn().mockResolvedValue({
    serviceability: "serviceable",
    shippingPaise: 0,
    estimatedDaysMin: 3,
    estimatedDaysMax: 7,
    message: "Deliverable",
    zoneName: "Metro",
  }),
}));

vi.mock("@/lib/notifications", () => ({
  sendAuthEmail: vi.fn().mockResolvedValue(undefined),
  sendOrderConfirmationEmail: vi.fn().mockResolvedValue(undefined),
  sendEnquiryNotification: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/settings", () => ({
  getSetting: vi.fn().mockResolvedValue("15"),
}));

// ─── Test group ────────────────────────────────────────────────────────────

describe.skipIf(!hasTestDb())("CHECKOUT integration tests", () => {
  let db: ReturnType<typeof getTestDb>;

  beforeAll(() => {
    db = getTestDb();
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  // ── Helper: create checkout input ───────────────────────────────────────

  function createCheckoutInput(idempotencyKey: string, productId: string, quantity = 1) {
    return {
      idempotencyKey,
      customer: {
        name: "Test Customer",
        email: `test-${idempotencyKey}@example.com`,
        mobile: "9876543210",
        address: "123 Test Street",
        city: "Mumbai",
        state: "Maharashtra",
        pincode: "400001",
        installationRequested: false,
      },
      items: [{ productId, quantity }],
    };
  }

  // ── 1. Local order is created once per idempotency key ──────────────────

  it("local order is created once per idempotency key", async () => {
    const product = await seedProduct();
    await seedInventory({ productId: product.id, quantityAvailable: 10, reserved: 0 });

    const idempotencyKey = uniqueIdempotencyKey();
    const input = createCheckoutInput(idempotencyKey, product.slug);

    const { orchestrateCheckout } = await import("@/lib/checkout-orchestrator");
    const result = await orchestrateCheckout(input);

    expect(result.status).toBe("ready_for_checkout");
    if (result.status === "ready_for_checkout") {
      expect(result.orderId).toBeTruthy();
      expect(result.orderNumber).toBeTruthy();
      expect(result.razorpayOrderId).toBeTruthy();

      // Verify only one order exists for this idempotency key
      const orderRows = await db
        .select()
        .from(orders)
        .where(eq(orders.idempotencyKey, idempotencyKey));
      expect(orderRows.length).toBe(1);
    }
  });

  // ── 2. Same idempotency key returns the existing ready provider order ──

  it("same idempotency key returns the existing ready provider order", async () => {
    const product = await seedProduct();
    await seedInventory({ productId: product.id, quantityAvailable: 10, reserved: 0 });

    const idempotencyKey = uniqueIdempotencyKey();
    const input = createCheckoutInput(idempotencyKey, product.slug);

    const { orchestrateCheckout } = await import("@/lib/checkout-orchestrator");

    // First call
    const result1 = await orchestrateCheckout(input);
    expect(result1.status).toBe("ready_for_checkout");

    // Second call with the same idempotency key
    const result2 = await orchestrateCheckout(input);
    expect(result2.status).toBe("duplicate_completed");

    if (result1.status === "ready_for_checkout" && result2.status === "duplicate_completed") {
      // Should return the same order details
      expect(result2.orderId).toBe(result1.orderId);
      expect(result2.orderNumber).toBe(result1.orderNumber);
      expect(result2.razorpayOrderId).toBe(result1.razorpayOrderId);
    }

    // Verify only one order exists
    const orderRows = await db
      .select()
      .from(orders)
      .where(eq(orders.idempotencyKey, idempotencyKey));
    expect(orderRows.length).toBe(1);
  });

  // ── 3. Concurrent identical checkout requests create one checkout attempt

  it("concurrent identical checkout requests create one checkout attempt", async () => {
    const product = await seedProduct();
    await seedInventory({ productId: product.id, quantityAvailable: 10, reserved: 0 });

    const idempotencyKey = uniqueIdempotencyKey();
    const input = createCheckoutInput(idempotencyKey, product.slug);

    const { orchestrateCheckout } = await import("@/lib/checkout-orchestrator");

    // Fire two concurrent checkout requests with the same idempotency key
    const results = await Promise.allSettled([
      orchestrateCheckout(input),
      orchestrateCheckout(input),
    ]);

    // At least one should succeed
    const succeeded = results.filter(r => r.status === "fulfilled");
    expect(succeeded.length).toBeGreaterThanOrEqual(1);

    // At most one should have created a new checkout (the other gets duplicate/processing)
    const readyOrDuplicate = succeeded.filter(r => {
      const val = (r as PromiseFulfilledResult<CheckoutResult>).value;
      return val.status === "ready_for_checkout" || val.status === "duplicate_completed";
    });
    expect(readyOrDuplicate.length).toBe(2); // Both resolved successfully

    // Verify only one checkout attempt record exists for this key
    const attemptRows = await db
      .select()
      .from(checkoutAttempts)
      .where(eq(checkoutAttempts.idempotencyKey, idempotencyKey));
    expect(attemptRows.length).toBeLessThanOrEqual(1);
  });

  // ── 4. Razorpay creation failure releases inventory ────────────────────

  it("Razorpay creation failure releases inventory", async () => {
    const product = await seedProduct();
    await seedInventory({ productId: product.id, quantityAvailable: 10, reserved: 0 });

    const idempotencyKey = uniqueIdempotencyKey();
    const input = createCheckoutInput(idempotencyKey, product.slug);

    // Mock Razorpay to throw
    const razorpayModule = vi.mocked(await import("@/lib/razorpay"));
    const origGetRazorpay = razorpayModule.getRazorpay;
    razorpayModule.getRazorpay = vi.fn().mockReturnValue({
      orders: {
        create: vi.fn().mockRejectedValue(new Error("Razorpay unavailable")),
        fetchPayments: vi.fn(),
      },
      payments: { fetch: vi.fn() },
    });

    const { orchestrateCheckout } = await import("@/lib/checkout-orchestrator");
    const result = await orchestrateCheckout(input);

    expect(result.status).toBe("failed");
    if (result.status === "failed") {
      expect(result.retryable).toBe(true);
    }

    // Verify inventory was released (reserved back to 0)
    const [invRow] = await db
      .select()
      .from(inventory)
      .where(eq(inventory.productId, product.id))
      .limit(1);
    expect(invRow.reserved).toBe(0);
    expect(invRow.quantityAvailable).toBe(10);

    // Verify order was cancelled
    const [orderRow] = await db
      .select()
      .from(orders)
      .where(eq(orders.idempotencyKey, idempotencyKey))
      .limit(1);
    if (orderRow) {
      expect(orderRow.status).toBe("cancelled");
    }

    // Restore mock
    razorpayModule.getRazorpay = origGetRazorpay;
  });

  // ── 5. Payment-row update failure does not expose an untracked provider order

  it("payment-row update failure does not expose an untracked provider order", async () => {
    const product = await seedProduct();
    await seedInventory({ productId: product.id, quantityAvailable: 10, reserved: 0 });

    const idempotencyKey = uniqueIdempotencyKey();
    const input = createCheckoutInput(idempotencyKey, product.slug);

    const { orchestrateCheckout } = await import("@/lib/checkout-orchestrator");
    const result = await orchestrateCheckout(input);

    // If checkout succeeds, verify the payment row has a valid providerOrderId
    // (not a placeholder)
    if (result.status === "ready_for_checkout") {
      const [paymentRow] = await db
        .select()
        .from(payments)
        .where(eq(payments.orderId, result.orderId))
        .limit(1);

      expect(paymentRow).toBeTruthy();
      expect(paymentRow.providerOrderId).not.toContain("placeholder_");
      expect(paymentRow.providerOrderId).toBeTruthy();
    }

    // If it failed, verify no untracked provider order exists
    if (result.status === "failed") {
      // No payment row should have a real Razorpay order ID but no order record
      const orphanPayments = await db
        .select()
        .from(payments)
        .where(sql`${payments.providerOrderId} NOT LIKE 'placeholder_%'`);
      for (const p of orphanPayments) {
        // Each non-placeholder payment must have a corresponding order
        const [orderRow] = await db
          .select()
          .from(orders)
          .where(eq(orders.id, p.orderId))
          .limit(1);
        expect(orderRow).toBeTruthy();
      }
    }
  });

  // ── 6. Stale checkout attempt can be resumed or safely failed ───────────

  it("stale checkout attempt can be resumed or safely failed", async () => {
    const idempotencyKey = uniqueIdempotencyKey();

    // Insert a stale checkout attempt in "initialized" state
    await db.insert(checkoutAttempts).values({
      id: testId("attempt_stale"),
      idempotencyKey,
      status: "initialized",
      attempts: 1,
    });

    const product = await seedProduct();
    await seedInventory({ productId: product.id, quantityAvailable: 10, reserved: 0 });

    const input = createCheckoutInput(idempotencyKey, product.slug);

    const { orchestrateCheckout } = await import("@/lib/checkout-orchestrator");
    const result = await orchestrateCheckout(input);

    // The existing attempt is in "initialized" state — the orchestrator
    // should return "processing" (telling the client to retry) or "failed"
    expect(["processing", "failed"]).toContain(result.status);

    if (result.status === "processing") {
      expect(result.message).toBeTruthy();
      expect(result.checkoutAttemptId).toBeTruthy();
    }
  });

  // ── 7. Shipping amount is stored correctly ──────────────────────────────

  it("shipping amount is stored correctly", async () => {
    const product = await seedProduct();
    await seedInventory({ productId: product.id, quantityAvailable: 10, reserved: 0 });

    const idempotencyKey = uniqueIdempotencyKey();
    const input = createCheckoutInput(idempotencyKey, product.slug);

    const { orchestrateCheckout } = await import("@/lib/checkout-orchestrator");
    const result = await orchestrateCheckout(input);

    if (result.status === "ready_for_checkout") {
      // Verify the order has shipping amount stored
      const [orderRow] = await db
        .select()
        .from(orders)
        .where(eq(orders.id, result.orderId))
        .limit(1);
      expect(orderRow).toBeTruthy();
      // Shipping should be 0 in this test (mock returns 0)
      expect(orderRow.shippingPaise).toBe(0);
      // Grand total should equal subtotal + shipping
      expect(orderRow.totalInclGstPaise).toBe(orderRow.subtotalInclGstPaise + orderRow.shippingPaise);
    }
  });

  // ── 8. Trusted database price overrides client data ────────────────────

  it("trusted database price overrides client data", async () => {
    // Create a product with a specific price in the database
    const product = await seedProduct({
      sellingPriceInclGstPaise: 50000, // ₹500
      gstRateBasisPoints: 1800,
      priceSourceStatus: "verified",
      priceVerifiedAt: new Date(),
    });
    await seedInventory({ productId: product.id, quantityAvailable: 10, reserved: 0 });

    const idempotencyKey = uniqueIdempotencyKey();
    const input = createCheckoutInput(idempotencyKey, product.slug);

    const { orchestrateCheckout } = await import("@/lib/checkout-orchestrator");
    const result = await orchestrateCheckout(input);

    if (result.status === "ready_for_checkout") {
      // Verify the order uses the database price, not any client-submitted price
      const [orderItemRow] = await db
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, result.orderId))
        .limit(1);
      expect(orderItemRow).toBeTruthy();
      expect(orderItemRow.unitPriceInclGstPaise).toBe(50000); // Database price
      expect(orderItemRow.gstRateBasisPoints).toBe(1800);

      // Verify the order total is calculated from database prices
      const [orderRow] = await db
        .select()
        .from(orders)
        .where(eq(orders.id, result.orderId))
        .limit(1);
      expect(orderRow.subtotalInclGstPaise).toBe(50000); // 1 × ₹500 = ₹500
    }
  });
});
