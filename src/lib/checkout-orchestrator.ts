/**
 * Central checkout orchestration service.
 *
 * Manages the full checkout lifecycle using checkoutAttempts for idempotency
 * tracking. The API route validates the request and delegates all business
 * logic here.
 *
 * ── Idempotency ──────────────────────────────────────────────────────────
 * The idempotency key is enforced atomically at the database level using
 * `INSERT ... ON CONFLICT (idempotency_key) DO NOTHING`. If the insert
 * returns zero rows, a concurrent request won the race; we load the existing
 * attempt and return its current state. Two concurrent requests with the
 * same key therefore produce exactly one checkout attempt and at most one
 * order.
 *
 * ── Saga compensation ────────────────────────────────────────────────────
 * Every failure path is handled by `compensateCheckoutFailure`, which
 * inspects `lastCompletedStep` to decide which resources exist and undoes
 * them in reverse order. Compensation never deletes financial evidence and
 * never cancels a paid or potentially-paid order. When automatic
 * compensation is unsafe (e.g. a Razorpay order may have been created but
 * its ID was not durably persisted), the attempt is moved to
 * `manual_intervention_required` with a safe reason string.
 *
 * ── Stale attempt recovery ───────────────────────────────────────────────
 * `recoverStaleCheckoutAttempts` is invoked from the cron runner. It finds
 * attempts stuck in non-terminal states with old `updatedAt` timestamps and
 * either resumes, reconciles with Razorpay, releases inventory, cancels the
 * order, or moves to manual intervention. It never returns "processing"
 * forever.
 *
 * ── Local test mode ──────────────────────────────────────────────────────
 * Test mode is detected BEFORE `getDb()` is called, so the database-free
 * local test flow actually works. Test mode is never allowed in production.
 */

import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getDb, isDatabaseConfigured } from "@/db/client";
import {
  addresses,
  checkoutAttempts,
  customers,
  orderItems,
  orders,
  payments,
  products as productTable,
  type checkoutAttemptStatus,
} from "@/db/schema";
import { catalogue } from "@/data/catalog";
import { createOrderConfirmationToken } from "@/lib/order-token";
import { calculateCartTotals, extractIncludedGst } from "@/lib/products";
import { getPriceMaxAgeDays } from "@/config/site";
import { logger } from "@/lib/logger";
import { getRazorpay } from "@/lib/razorpay";
import { reserveInventoryForOrder, releaseReservationsForOrder, cleanupExpiredReservationsBeforeCheckout } from "@/lib/inventory";
import { isRazorpayConfigured } from "@/lib/env";

// ─── Types ────────────────────────────────────────────────────────────────

export type CheckoutInput = {
  idempotencyKey: string;
  customer: {
    name: string;
    email: string;
    mobile: string;
    gstin?: string;
    businessName?: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
    instructions?: string;
    installationRequested: boolean;
  };
  items: Array<{ productId: string; quantity: number }>;
  website?: string;
};

export type CheckoutResult =
  | {
      status: "ready_for_checkout";
      orderId: string;
      orderNumber: string;
      razorpayOrderId: string;
      amountPaise: number;
      keyId: string;
      totals: Record<string, unknown>;
      shipping: Record<string, unknown>;
      confirmationToken?: string;
    }
  | {
      status: "processing";
      checkoutAttemptId: string;
      message: string;
    }
  | {
      status: "duplicate_completed";
      orderId: string;
      orderNumber: string;
      razorpayOrderId: string;
      amountPaise: number;
      keyId: string;
    }
  | {
      status: "failed";
      error: string;
      retryable: boolean;
    }
  | {
      status: "manual_intervention_required";
      checkoutAttemptId: string;
      message: string;
    }
  | {
      status: "test_mode";
      orderNumber: string;
      confirmationToken: string;
      totals: Record<string, unknown>;
      message: string;
    };

type AttemptStatus = typeof checkoutAttemptStatus.enumValues[number];

// Staleness thresholds. An attempt whose `updatedAt` is older than the
// threshold for its current state is considered stale and eligible for
// recovery.
const STALE_THRESHOLDS: Record<AttemptStatus, number> = {
  initialized: 2 * 60_000, // 2 min — nothing happened, safe to fail
  local_order_created: 5 * 60_000, // 5 min
  inventory_reserved: 5 * 60_000, // 5 min
  provider_order_creating: 10 * 60_000, // 10 min — may have a remote order
  provider_order_created: 10 * 60_000, // 10 min — remote order exists
  payment_recorded: 10 * 60_000, // 10 min
  ready_for_checkout: 30 * 60_000, // 30 min — waiting for customer to pay
  failed: 0,
  cancelled: 0,
  manual_intervention_required: 0,
};

// ─── Main orchestration function ──────────────────────────────────────────

export async function orchestrateCheckout(input: CheckoutInput): Promise<CheckoutResult> {
  // ── Test mode check — BEFORE getDb() so the DB-free flow works ─────────
  // Test mode is only allowed outside production AND when Razorpay is not
  // configured. In production, a missing Razorpay config is a hard failure.
  if (process.env.NODE_ENV !== "production" && !isRazorpayConfigured()) {
    return handleTestModeCheckout(input);
  }

  if (!isRazorpayConfigured()) {
    return {
      status: "failed",
      error: "Online payments are not active yet. Please request a quote instead.",
      retryable: false,
    };
  }
  if (!isDatabaseConfigured()) {
    return {
      status: "failed",
      error: "Online payments are not active yet. Please request a quote instead.",
      retryable: false,
    };
  }

  const db = getDb();

  // ── Step 1: Atomic idempotency insert ──────────────────────────────────
  // INSERT ... ON CONFLICT DO NOTHING. If this returns a row, we won the
  // race and may proceed. If it returns nothing, a concurrent request
  // already created the attempt; we load it and return its current state.
  const inserted = await db
    .insert(checkoutAttempts)
    .values({
      idempotencyKey: input.idempotencyKey,
      status: "initialized",
      attempts: 1,
    })
    .onConflictDoNothing({ target: checkoutAttempts.idempotencyKey })
    .returning({ id: checkoutAttempts.id });

  if (inserted.length === 0) {
    // Lost the race. Load the existing attempt and return its state.
    const [existing] = await db
      .select()
      .from(checkoutAttempts)
      .where(eq(checkoutAttempts.idempotencyKey, input.idempotencyKey))
      .limit(1);
    if (!existing) {
      // Extremely unlikely: conflict on insert but row not found. This can
      // happen if the row was deleted between the conflict and the select.
      // Fail closed.
      return {
        status: "failed",
        error: "Checkout could not be started. Please retry.",
        retryable: true,
      };
    }
    return handleExistingAttempt(db, existing);
  }

  const attemptId = inserted[0].id;

  try {
    return await runCheckoutSaga(db, attemptId, input);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    // Central compensation: inspect lastCompletedStep and undo safely.
    await compensateCheckoutFailure(db, attemptId, "unexpected_error", message);
    logger.error(
      { event: "checkout_orchestration_failed", idempotencyKey: input.idempotencyKey, error: message },
      "Checkout orchestration failed unexpectedly",
    );
    return { status: "failed", error: "An unexpected error occurred. Please retry.", retryable: true };
  }
}

// ─── Existing-attempt handler ─────────────────────────────────────────────

async function handleExistingAttempt(
  db: ReturnType<typeof getDb>,
  existing: typeof checkoutAttempts.$inferSelect,
): Promise<CheckoutResult> {
  switch (existing.status) {
    case "ready_for_checkout": {
      // Return existing Razorpay order details so the customer can retry payment.
      const [payment] = await db
        .select()
        .from(payments)
        .where(eq(payments.orderId, existing.orderId!))
        .limit(1);
      const [order] = await db
        .select()
        .from(orders)
        .where(eq(orders.id, existing.orderId!))
        .limit(1);
      if (!payment || !order) {
        // The attempt says ready but the rows are gone — needs intervention.
        await markManualIntervention(db, existing.id, "ready_for_checkout but order or payment row missing");
        return {
          status: "manual_intervention_required",
          checkoutAttemptId: existing.id,
          message: "Your checkout needs attention. Please contact support.",
        };
      }
      return {
        status: "duplicate_completed",
        orderId: order.id,
        orderNumber: order.orderNumber,
        razorpayOrderId: payment.providerOrderId,
        amountPaise: payment.amountPaise,
        keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? process.env.RAZORPAY_KEY_ID ?? "",
      };
    }

    case "initialized":
    case "local_order_created":
    case "inventory_reserved":
    case "provider_order_creating":
    case "provider_order_created":
    case "payment_recorded": {
      // Check staleness. If the attempt is stale, kick off recovery now
      // rather than making the customer wait for the next cron tick.
      const ageMs = Date.now() - existing.updatedAt.getTime();
      if (ageMs > STALE_THRESHOLDS[existing.status]) {
        logger.warn(
          { event: "stale_attempt_recover_inline", attemptId: existing.id, status: existing.status, ageMs },
          "Stale checkout attempt detected during duplicate request; recovering inline",
        );
        await recoverStaleCheckoutAttempt(db, existing);
        // Re-read after recovery.
        const [recovered] = await db
          .select()
          .from(checkoutAttempts)
          .where(eq(checkoutAttempts.id, existing.id))
          .limit(1);
        if (recovered) return handleExistingAttempt(db, recovered);
      }
      // The attempt is still in flight. Poll briefly — a concurrent request
      // may be about to finish it. This makes the idempotent API return the
      // final result to both concurrent callers instead of making the loser
      // poll manually.
      const polled = await pollForTerminalState(db, existing.id, 5000, 200);
      if (polled) return handleExistingAttempt(db, polled);
      return {
        status: "processing",
        checkoutAttemptId: existing.id,
        message: "Your checkout is being processed. Please wait a moment and retry.",
      };
    }

    case "failed":
      return {
        status: "failed",
        error: existing.lastError ?? "Previous checkout attempt failed",
        retryable: true,
      };

    case "cancelled":
      return {
        status: "failed",
        error: "Previous checkout was cancelled",
        retryable: true,
      };

    case "manual_intervention_required":
      return {
        status: "manual_intervention_required",
        checkoutAttemptId: existing.id,
        message: existing.interventionReason ?? "Your checkout needs attention. Please contact support.",
      };
  }
}

// ─── Checkout saga ────────────────────────────────────────────────────────

async function runCheckoutSaga(
  db: ReturnType<typeof getDb>,
  attemptId: string,
  input: CheckoutInput,
): Promise<CheckoutResult> {
  // ── Validate products ───────────────────────────────────────────────────
  const requestedSlugs = input.items.map((line) => line.productId);
  const trustedProducts = await db
    .select()
    .from(productTable)
    .where(and(eq(productTable.status, "published"), inArray(productTable.slug, requestedSlugs)));

  const trustedLines = input.items.flatMap((line) => {
    const product = trustedProducts.find((item) => item.slug === line.productId);
    if (
      !product ||
      product.sellingPriceInclGstPaise === null ||
      product.priceSourceStatus !== "verified" ||
      product.stockStatus === "quote_only" ||
      product.stockStatus === "lead_time" ||
      !product.priceVerifiedAt ||
      Date.now() - product.priceVerifiedAt.getTime() > getPriceMaxAgeDays() * 86_400_000
    )
      return [];
    return [{ product, quantity: line.quantity }];
  });

  if (trustedLines.length !== input.items.length) {
    await failCheckoutAttempt(db, attemptId, "Catalogue prices changed. Refresh the cart before paying.");
    return { status: "failed", error: "Catalogue prices changed. Refresh the cart before paying.", retryable: true };
  }

  // ── Calculate totals ────────────────────────────────────────────────────
  const subtotalInclGstPaise = trustedLines.reduce(
    (sum, line) => sum + line.product.sellingPriceInclGstPaise! * line.quantity,
    0,
  );
  const includedGstPaise = trustedLines.reduce(
    (sum, line) =>
      sum +
      extractIncludedGst(
        line.product.sellingPriceInclGstPaise! * line.quantity,
        line.product.gstRateBasisPoints,
      ),
    0,
  );

  // ── Shipping validation ─────────────────────────────────────────────────
  const { getShippingQuote } = await import("@/lib/shipping");
  const shippingQuote = await getShippingQuote({
    pincode: input.customer.pincode,
    subtotalInclGstPaise,
    products: trustedLines.map((line) => ({
      model: line.product.model,
      quantity: line.quantity,
    })),
  });

  if (shippingQuote.serviceability === "unserviceable") {
    await failCheckoutAttempt(db, attemptId, shippingQuote.message);
    return { status: "failed", error: shippingQuote.message, retryable: false };
  }

  const shippingPaise = shippingQuote.shippingPaise;
  const grandTotalInclGstPaise = subtotalInclGstPaise + shippingPaise;

  const totals = {
    subtotalInclGstPaise,
    shippingPaise,
    installationPaise: null,
    includedGstPaise,
    grandTotalInclGstPaise,
  };

  // ── Step 2: Create customer + address + order + orderItems ──────────────
  const orderNumber = `DD-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${nanoid(6).toUpperCase()}`;

  const [savedCustomer] = await db
    .insert(customers)
    .values({
      name: input.customer.name,
      email: input.customer.email,
      mobile: input.customer.mobile,
      gstin: input.customer.gstin || null,
      businessName: input.customer.businessName || null,
    })
    .returning({ id: customers.id });

  const [savedAddress] = await db
    .insert(addresses)
    .values({
      customerId: savedCustomer.id,
      line1: input.customer.address,
      city: input.customer.city,
      state: input.customer.state,
      pincode: input.customer.pincode,
      instructions: input.customer.instructions || null,
    })
    .returning({ id: addresses.id });

  const [savedOrder] = await db
    .insert(orders)
    .values({
      orderNumber,
      customerId: savedCustomer.id,
      shippingAddressId: savedAddress.id,
      status: "payment_pending",
      subtotalInclGstPaise,
      shippingPaise,
      totalInclGstPaise: grandTotalInclGstPaise,
      includedGstPaise,
      installationRequested: input.customer.installationRequested,
      idempotencyKey: input.idempotencyKey,
      serviceabilityResult: shippingQuote as unknown as Record<string, unknown>,
      estimatedDeliveryAt: shippingQuote.estimatedDaysMax
        ? new Date(Date.now() + shippingQuote.estimatedDaysMax * 86_400_000)
        : null,
    })
    .returning({ id: orders.id });

  await db.insert(orderItems).values(
    trustedLines.map(({ product, quantity }) => ({
      orderId: savedOrder.id,
      productId: product.id,
      model: product.model,
      title: product.title,
      quantity,
      unitPriceInclGstPaise: product.sellingPriceInclGstPaise!,
      gstRateBasisPoints: product.gstRateBasisPoints,
    })),
  );

  // ── Step 3: local_order_created ─────────────────────────────────────────
  await db
    .update(checkoutAttempts)
    .set({ orderId: savedOrder.id, status: "local_order_created", lastCompletedStep: "local_order_created", updatedAt: new Date() })
    .where(eq(checkoutAttempts.id, attemptId));

  // ── Step 4: Create placeholder payment record ───────────────────────────
  // We create a placeholder payment BEFORE calling Razorpay so we have a
  // durable reference even if Razorpay creation succeeds but the payment-row
  // update fails. The placeholder provider_order_id is unique per attempt.
  const placeholderProviderOrderId = `placeholder_${attemptId}`;
  const [placeholderPayment] = await db
    .insert(payments)
    .values({
      orderId: savedOrder.id,
      providerOrderId: placeholderProviderOrderId,
      status: "created",
      amountPaise: grandTotalInclGstPaise,
    })
    .returning({ id: payments.id });

  // ── Step 5: Cleanup expired reservations ────────────────────────────────
  await cleanupExpiredReservationsBeforeCheckout(
    trustedLines.map((line) => ({ productId: line.product.id, quantity: line.quantity })),
  );

  // ── Step 6: Reserve inventory ───────────────────────────────────────────
  try {
    await reserveInventoryForOrder({
      orderId: savedOrder.id,
      items: trustedLines.map((line) => ({
        productId: line.product.id,
        quantity: line.quantity,
      })),
    });
  } catch (reserveError) {
    const message = reserveError instanceof Error ? reserveError.message : "Insufficient stock";
    await compensateCheckoutFailure(db, attemptId, "inventory_reservation_failed", message);
    logger.error(
      { event: "inventory_reservation_failed", orderNumber, error: message },
      "Inventory reservation failed during checkout",
    );
    return {
      status: "failed",
      error: "Insufficient stock for one or more items. Please adjust your cart.",
      retryable: true,
    };
  }

  // ── Step 6b: inventory_reserved ─────────────────────────────────────────
  await db
    .update(checkoutAttempts)
    .set({ status: "inventory_reserved", lastCompletedStep: "inventory_reserved", updatedAt: new Date() })
    .where(eq(checkoutAttempts.id, attemptId));

  // ── Step 7: provider_order_creating ─────────────────────────────────────
  // NOTE: we set `status` to provider_order_creating to indicate we're in
  // this phase, but `lastCompletedStep` stays at inventory_reserved until
  // the remote order is actually created. This way, compensation for a
  // Razorpay failure knows no remote order exists and can safely cancel.
  await db
    .update(checkoutAttempts)
    .set({ status: "provider_order_creating", updatedAt: new Date() })
    .where(eq(checkoutAttempts.id, attemptId));

  // ── Step 8: Create Razorpay order ───────────────────────────────────────
  let razorpayOrder: { id: string };
  try {
    razorpayOrder = await getRazorpay().orders.create({
      amount: grandTotalInclGstPaise,
      currency: "INR",
      receipt: orderNumber,
      notes: {
        customerEmail: input.customer.email,
        installationRequested: String(input.customer.installationRequested),
      },
    });
  } catch (razorpayError) {
    const message = razorpayError instanceof Error ? razorpayError.message : "Razorpay unavailable";
    // Compensation: release inventory, cancel unpaid order, fail payment.
    // This is safe because no remote order was created.
    await compensateCheckoutFailure(db, attemptId, "razorpay_create_failed", message);
    logger.error(
      { event: "razorpay_order_create_failed", orderNumber, error: message },
      "Razorpay order creation failed",
    );
    return {
      status: "failed",
      error: "Payment provider is unavailable. Please retry or request a quote.",
      retryable: true,
    };
  }

  // ── Step 8b: provider_order_created ─────────────────────────────────────
  // At this point the remote Razorpay order exists. We record the ID on the
  // attempt BEFORE trying to update the payment row, so that even if the
  // payment row update fails, the recovery routine can find the remote order.
  await db
    .update(checkoutAttempts)
    .set({
      status: "provider_order_created",
      providerOrderId: razorpayOrder.id,
      lastCompletedStep: "provider_order_created",
      updatedAt: new Date(),
    })
    .where(eq(checkoutAttempts.id, attemptId));

  // ── Step 9: Update payment record with the real providerOrderId ─────────
  // Retry bounded times. If this ultimately fails, we CANNOT safely
  // compensate by cancelling — the remote order exists and the customer
  // might pay against it. Move to manual intervention.
  const paymentUpdateAttempts = 3;
  let paymentUpdated = false;
  for (let i = 0; i < paymentUpdateAttempts; i++) {
    try {
      await db
        .update(payments)
        .set({
          providerOrderId: razorpayOrder.id,
          status: "created",
          updatedAt: new Date(),
        })
        .where(eq(payments.id, placeholderPayment.id));
      paymentUpdated = true;
      break;
    } catch (updateError) {
      logger.warn(
        { event: "payment_update_retry", attempt: i + 1, orderId: savedOrder.id, error: updateError instanceof Error ? updateError.message : "unknown" },
        "Retrying payment row update",
      );
      if (i === paymentUpdateAttempts - 1) {
        // Persistence failure after a successful remote create. The remote
        // order exists and may be paid. Manual intervention required.
        await markManualIntervention(
          db,
          attemptId,
          "provider_order_created_but_payment_row_not_persisted",
        );
        logger.error(
          { event: "payment_row_update_failed", orderId: savedOrder.id, providerOrderId: razorpayOrder.id },
          "Payment row update failed after retries; remote Razorpay order exists",
        );
        return {
          status: "manual_intervention_required",
          checkoutAttemptId: attemptId,
          message: "Your payment setup needs attention. Please contact support with your order number.",
        };
      }
    }
  }

  void paymentUpdated; // asserted true above

  // ── Step 10: payment_recorded ───────────────────────────────────────────
  await db
    .update(checkoutAttempts)
    .set({ status: "payment_recorded", lastCompletedStep: "payment_recorded", updatedAt: new Date() })
    .where(eq(checkoutAttempts.id, attemptId));

  // ── Step 11: ready_for_checkout ─────────────────────────────────────────
  await db
    .update(checkoutAttempts)
    .set({
      status: "ready_for_checkout",
      providerOrderId: razorpayOrder.id,
      lastCompletedStep: "ready_for_checkout",
      updatedAt: new Date(),
    })
    .where(eq(checkoutAttempts.id, attemptId));

  logger.info(
    { event: "checkout_orchestrated", orderNumber, providerOrderId: razorpayOrder.id },
    "Checkout orchestrated successfully",
  );

  return {
    status: "ready_for_checkout",
    orderId: savedOrder.id,
    orderNumber,
    razorpayOrderId: razorpayOrder.id,
    amountPaise: grandTotalInclGstPaise,
    keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? process.env.RAZORPAY_KEY_ID ?? "",
    totals,
    shipping: shippingQuote,
  };
}

// ─── Central compensation routine ─────────────────────────────────────────
//
// Inspects `lastCompletedStep` to decide which resources exist and undoes
// them in reverse order. Compensation:
//   - NEVER deletes financial evidence (payments, orders).
//   - NEVER cancels a paid or potentially-paid order.
//   - Releases active reservations exactly once.
//   - Marks placeholder payments as failed.
//   - Moves to manual_intervention_required when automatic compensation is
//     unsafe (e.g. a remote Razorpay order may exist but wasn't persisted).

async function compensateCheckoutFailure(
  db: ReturnType<typeof getDb>,
  attemptId: string,
  reason: string,
  detail: string,
): Promise<void> {
  const [attempt] = await db
    .select()
    .from(checkoutAttempts)
    .where(eq(checkoutAttempts.id, attemptId))
    .limit(1);
  if (!attempt) return;

  const step = attempt.lastCompletedStep;
  const orderId = attempt.orderId;

  // Log the compensation with a safe, redacted reason.
  logger.warn(
    {
      event: "checkout_compensation_started",
      attemptId,
      orderId,
      lastCompletedStep: step,
      reason,
    },
    "Compensating checkout failure",
  );

  try {
    switch (step) {
      case null:
      case undefined:
      case "initialized":
        // Nothing was created. Just fail.
        await failCheckoutAttempt(db, attemptId, detail);
        return;

      case "local_order_created": {
        // Order + customer + address + orderItems + placeholder payment exist.
        // No inventory reserved, no remote order. Safe to cancel.
        if (orderId) {
          await releaseReservationsForOrder(orderId, "checkout_failed_local_order_created").catch(() => {});
          await db.update(orders).set({ status: "cancelled", updatedAt: new Date() }).where(eq(orders.id, orderId));
          await db
            .update(payments)
            .set({ status: "failed", updatedAt: new Date() })
            .where(and(eq(payments.orderId, orderId), eq(payments.providerOrderId, `placeholder_${attemptId}`)));
        }
        await failCheckoutAttempt(db, attemptId, detail);
        return;
      }

      case "inventory_reserved": {
        // Inventory was reserved. Release it, then cancel.
        if (orderId) {
          await releaseReservationsForOrder(orderId, "checkout_failed_inventory_reserved").catch(() => {});
          await db.update(orders).set({ status: "cancelled", updatedAt: new Date() }).where(eq(orders.id, orderId));
          await db
            .update(payments)
            .set({ status: "failed", updatedAt: new Date() })
            .where(and(eq(payments.orderId, orderId), eq(payments.providerOrderId, `placeholder_${attemptId}`)));
        }
        await failCheckoutAttempt(db, attemptId, detail);
        return;
      }

      case "provider_order_creating": {
        // We were in the middle of calling Razorpay when the error happened.
        // We don't know if the remote order was created. Move to manual
        // intervention — the recovery routine will reconcile with Razorpay.
        if (orderId) {
          // Release inventory optimistically; if a remote order exists and is
          // later paid, the reconciliation routine will re-reserve.
          await releaseReservationsForOrder(orderId, "checkout_failed_provider_order_creating").catch(() => {});
        }
        await markManualIntervention(db, attemptId, `provider_order_creating:${reason}`);
        return;
      }

      case "provider_order_created": {
        // A remote Razorpay order exists. Do NOT cancel — the customer might
        // pay against it. Manual intervention.
        await markManualIntervention(db, attemptId, `provider_order_created:${reason}`);
        return;
      }

      case "payment_recorded":
      case "ready_for_checkout": {
        // Payment record exists and (for ready_for_checkout) the remote order
        // exists. Do NOT cancel. Manual intervention.
        await markManualIntervention(db, attemptId, `${step}:${reason}`);
        return;
      }

      default:
        await failCheckoutAttempt(db, attemptId, detail);
        return;
    }
  } catch (compensationError) {
    // Compensation itself failed. Move to manual intervention.
    logger.error(
      {
        event: "checkout_compensation_failed",
        attemptId,
        orderId,
        reason,
        error: compensationError instanceof Error ? compensationError.message : "unknown",
      },
      "Checkout compensation itself failed; moving to manual intervention",
    );
    await markManualIntervention(db, attemptId, `compensation_failed:${reason}`);
  }
}

// ─── Stale attempt recovery ───────────────────────────────────────────────
//
// Called from the cron runner. Finds attempts in non-terminal states whose
// `updatedAt` is older than the threshold for that state, and recovers them.
// Recovery is idempotent: it checks the actual state of the order, payment,
// and reservations before deciding what to do.

export async function recoverStaleCheckoutAttempts(opts?: {
  limit?: number;
}): Promise<{ recovered: number; manualIntervention: number; failed: number }> {
  if (!isDatabaseConfigured()) return { recovered: 0, manualIntervention: 0, failed: 0 };
  const db = getDb();
  const limit = opts?.limit ?? 50;

  // Find all non-terminal attempts.
  const nonTerminal: AttemptStatus[] = [
    "initialized",
    "local_order_created",
    "inventory_reserved",
    "provider_order_creating",
    "provider_order_created",
    "payment_recorded",
    "ready_for_checkout",
  ];

  const stale = await db
    .select()
    .from(checkoutAttempts)
    .where(inArray(checkoutAttempts.status, nonTerminal))
    .limit(limit);

  let recovered = 0;
  let manualIntervention = 0;
  let failed = 0;

  const now = Date.now();
  for (const attempt of stale) {
    const ageMs = now - attempt.updatedAt.getTime();
    if (ageMs <= STALE_THRESHOLDS[attempt.status]) continue;
    try {
      const result = await recoverStaleCheckoutAttempt(db, attempt);
      if (result === "recovered") recovered++;
      else if (result === "manual_intervention") manualIntervention++;
      else if (result === "failed") failed++;
    } catch (error) {
      logger.error(
        { event: "stale_attempt_recovery_error", attemptId: attempt.id, error: error instanceof Error ? error.message : "unknown" },
        "Stale attempt recovery threw",
      );
      manualIntervention++;
    }
  }

  return { recovered, manualIntervention, failed };
}

async function recoverStaleCheckoutAttempt(
  db: ReturnType<typeof getDb>,
  attempt: typeof checkoutAttempts.$inferSelect,
): Promise<"recovered" | "manual_intervention" | "failed" | "skipped"> {
  const orderId = attempt.orderId;
  const step = attempt.lastCompletedStep;

  switch (attempt.status) {
    case "initialized": {
      // Nothing was created. Safe to fail.
      await failCheckoutAttempt(db, attempt.id, "Stale initialized attempt");
      return "failed";
    }

    case "local_order_created": {
      // Order exists, no inventory reserved, no remote order. Cancel.
      if (orderId) {
        await db.update(orders).set({ status: "cancelled", updatedAt: new Date() }).where(eq(orders.id, orderId));
        await db
          .update(payments)
          .set({ status: "failed", updatedAt: new Date() })
          .where(and(eq(payments.orderId, orderId), eq(payments.providerOrderId, `placeholder_${attempt.id}`)));
      }
      await failCheckoutAttempt(db, attempt.id, "Stale local_order_created attempt");
      return "failed";
    }

    case "inventory_reserved": {
      // Inventory is reserved. Release and cancel.
      if (orderId) {
        await releaseReservationsForOrder(orderId, "stale_inventory_reserved").catch(() => {});
        await db.update(orders).set({ status: "cancelled", updatedAt: new Date() }).where(eq(orders.id, orderId));
        await db
          .update(payments)
          .set({ status: "failed", updatedAt: new Date() })
          .where(and(eq(payments.orderId, orderId), eq(payments.providerOrderId, `placeholder_${attempt.id}`)));
      }
      await failCheckoutAttempt(db, attempt.id, "Stale inventory_reserved attempt");
      return "failed";
    }

    case "provider_order_creating": {
      // We don't know if the remote order was created. Try to reconcile.
      if (!orderId) {
        await failCheckoutAttempt(db, attempt.id, "Stale provider_order_creating with no order");
        return "failed";
      }
      // Check if the order already has a real provider_order_id (the
      // crash happened after the remote create but before we updated the
      // attempt).
      const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
      const [payment] = await db
        .select()
        .from(payments)
        .where(and(eq(payments.orderId, orderId), isNotNull(payments.providerOrderId)))
        .limit(1);
      if (payment && !payment.providerOrderId.startsWith("placeholder_")) {
        // The payment row has a real provider order ID. Resume from there.
        await db
          .update(checkoutAttempts)
          .set({
            status: "ready_for_checkout",
            providerOrderId: payment.providerOrderId,
            lastCompletedStep: "ready_for_checkout",
            updatedAt: new Date(),
          })
          .where(eq(checkoutAttempts.id, attempt.id));
        logger.info(
          { event: "stale_attempt_resumed", attemptId: attempt.id, providerOrderId: payment.providerOrderId },
          "Resumed stale provider_order_creating attempt — payment row had real provider ID",
        );
        return "recovered";
      }
      // No real provider ID anywhere. Release inventory and move to manual
      // intervention — the remote order may or may not exist.
      await releaseReservationsForOrder(orderId, "stale_provider_order_creating").catch(() => {});
      await markManualIntervention(db, attempt.id, "stale_provider_order_creating_unknown_remote_state");
      return "manual_intervention";
    }

    case "provider_order_created": {
      // Remote order exists. Check if it was paid.
      if (!orderId || !attempt.providerOrderId) {
        await markManualIntervention(db, attempt.id, "stale_provider_order_created_missing_id");
        return "manual_intervention";
      }
      try {
        const razorpayOrder = await getRazorpay().orders.fetch(attempt.providerOrderId);
        const paid = (razorpayOrder as { amount_paid?: number }).amount_paid ?? 0;
        if (paid > 0) {
          // The remote order was paid! Move to manual intervention — the
          // payment-processing module will reconcile via webhook or the
          // reconciliation routine.
          await markManualIntervention(db, attempt.id, "stale_provider_order_created_remote_paid");
          return "manual_intervention";
        }
        // Not paid. Release inventory and cancel.
        await releaseReservationsForOrder(orderId, "stale_provider_order_created_unpaid").catch(() => {});
        await db.update(orders).set({ status: "cancelled", updatedAt: new Date() }).where(eq(orders.id, orderId));
        await db
          .update(payments)
          .set({ status: "failed", updatedAt: new Date() })
          .where(eq(payments.orderId, orderId));
        await failCheckoutAttempt(db, attempt.id, "Stale provider_order_created (unpaid)");
        return "failed";
      } catch (fetchError) {
        logger.warn(
          { event: "razorpay_fetch_failed", attemptId: attempt.id, error: fetchError instanceof Error ? fetchError.message : "unknown" },
          "Could not fetch Razorpay order during stale recovery",
        );
        await markManualIntervention(db, attempt.id, "stale_provider_order_created_fetch_failed");
        return "manual_intervention";
      }
    }

    case "payment_recorded":
    case "ready_for_checkout": {
      // These are near-terminal. If stale, the customer abandoned. Move to
      // manual intervention — do NOT cancel, the order may have been paid
      // out-of-band.
      await markManualIntervention(db, attempt.id, `stale_${attempt.status}`);
      return "manual_intervention";
    }

    default:
      return "skipped";
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────

async function failCheckoutAttempt(db: ReturnType<typeof getDb>, attemptId: string, error: string): Promise<void> {
  await db
    .update(checkoutAttempts)
    .set({ status: "failed", lastError: error.slice(0, 500), updatedAt: new Date() })
    .where(eq(checkoutAttempts.id, attemptId));
}

async function markManualIntervention(
  db: ReturnType<typeof getDb>,
  attemptId: string,
  reason: string,
): Promise<void> {
  await db
    .update(checkoutAttempts)
    .set({
      status: "manual_intervention_required",
      interventionReason: reason.slice(0, 500),
      updatedAt: new Date(),
    })
    .where(eq(checkoutAttempts.id, attemptId));
}

/**
 * Poll a checkout attempt until it reaches a terminal state or the timeout
 * expires. Used by `handleExistingAttempt` so that a concurrent request
 * that lost the idempotency race still returns the final result to the
 * caller instead of a generic "processing" response.
 *
 * Terminal states: ready_for_checkout, failed, cancelled,
 * manual_intervention_required.
 */
async function pollForTerminalState(
  db: ReturnType<typeof getDb>,
  attemptId: string,
  timeoutMs: number,
  intervalMs: number,
): Promise<typeof checkoutAttempts.$inferSelect | null> {
  const deadline = Date.now() + timeoutMs;
  const terminal: AttemptStatus[] = [
    "ready_for_checkout",
    "failed",
    "cancelled",
    "manual_intervention_required",
  ];
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    const [row] = await db
      .select()
      .from(checkoutAttempts)
      .where(eq(checkoutAttempts.id, attemptId))
      .limit(1);
    if (!row) return null;
    if (terminal.includes(row.status)) return row;
  }
  return null;
}

function handleTestModeCheckout(input: CheckoutInput): CheckoutResult {
  const previewLines = input.items.flatMap((line) => {
    const product = catalogue.find((item) => item.id === line.productId);
    return product ? [{ product, quantity: line.quantity }] : [];
  });
  const previewTotals = calculateCartTotals(previewLines);
  const orderNumber = `DD-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${nanoid(6).toUpperCase()}`;

  return {
    status: "test_mode",
    orderNumber,
    confirmationToken: createOrderConfirmationToken(orderNumber),
    totals: previewTotals,
    message: "Server-confirmed local test order; no payment was captured.",
  };
}
