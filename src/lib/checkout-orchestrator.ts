/**
 * Central checkout orchestration service.
 *
 * Manages the full checkout lifecycle using checkoutAttempts for
 * idempotency tracking. The API route validates the request and
 * delegates all business logic here.
 *
 * The neon-http driver does NOT support interactive transactions with
 * row locks, so all atomic operations use conditional UPDATEs with
 * RETURNING.
 */

import { and, eq, inArray } from "drizzle-orm";
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
} from "@/db/schema";
import { catalogue } from "@/data/catalog";
import { createOrderConfirmationToken } from "@/lib/order-token";
import { calculateCartTotals, extractIncludedGst, getPurchaseEligibility } from "@/lib/products";
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
      status: "test_mode";
      orderNumber: string;
      confirmationToken: string;
      totals: Record<string, unknown>;
      message: string;
    };

// ─── Main orchestration function ──────────────────────────────────────────

export async function orchestrateCheckout(input: CheckoutInput): Promise<CheckoutResult> {
  const db = getDb();

  // ── Step 1: Check idempotency key ──────────────────────────────────────
  const [existingAttempt] = await db
    .select()
    .from(checkoutAttempts)
    .where(eq(checkoutAttempts.idempotencyKey, input.idempotencyKey))
    .limit(1);

  if (existingAttempt) {
    if (existingAttempt.status === "ready_for_checkout") {
      // Return existing Razorpay order details.
      const [payment] = await db
        .select()
        .from(payments)
        .where(eq(payments.orderId, existingAttempt.orderId!))
        .limit(1);
      const [order] = await db
        .select()
        .from(orders)
        .where(eq(orders.id, existingAttempt.orderId!))
        .limit(1);
      if (!payment || !order) {
        return { status: "failed", error: "Existing checkout attempt has missing payment/order", retryable: false };
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

    if (
      existingAttempt.status === "initialized" ||
      existingAttempt.status === "local_order_created" ||
      existingAttempt.status === "inventory_reserved" ||
      existingAttempt.status === "provider_order_creating" ||
      existingAttempt.status === "provider_order_created" ||
      existingAttempt.status === "payment_recorded"
    ) {
      // Still processing — return controlled response.
      return {
        status: "processing",
        checkoutAttemptId: existingAttempt.id,
        message: "Your checkout is being processed. Please wait a moment and retry.",
      };
    }

    if (existingAttempt.status === "failed") {
      // Return error with retry indication.
      return {
        status: "failed",
        error: existingAttempt.lastError ?? "Previous checkout attempt failed",
        retryable: true,
      };
    }

    if (existingAttempt.status === "cancelled") {
      return {
        status: "failed",
        error: "Previous checkout was cancelled",
        retryable: true,
      };
    }
  }

  // ── Test mode check ─────────────────────────────────────────────────────
  if (
    process.env.NODE_ENV !== "production" &&
    !isRazorpayConfigured()
  ) {
    return handleTestModeCheckout(input);
  }

  if (!isRazorpayConfigured() || !isDatabaseConfigured()) {
    return {
      status: "failed",
      error: "Online payments are not active yet. Please request a quote instead.",
      retryable: false,
    };
  }

  // ── Step 2: Create checkout attempt record ──────────────────────────────
  const [attempt] = await db
    .insert(checkoutAttempts)
    .values({
      idempotencyKey: input.idempotencyKey,
      status: "initialized",
      attempts: 1,
    })
    .returning();

  if (!attempt) {
    return { status: "failed", error: "Failed to create checkout attempt", retryable: true };
  }

  try {
    // ── Validate products ────────────────────────────────────────────────
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
      await failCheckoutAttempt(db, attempt.id, "Catalogue prices changed. Refresh the cart before paying.");
      return { status: "failed", error: "Catalogue prices changed. Refresh the cart before paying.", retryable: true };
    }

    // ── Calculate totals ─────────────────────────────────────────────────
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

    // ── Shipping validation ──────────────────────────────────────────────
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
      await failCheckoutAttempt(db, attempt.id, shippingQuote.message);
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

    // ── Step 3: Create customer + address + order + orderItems ────────────
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

    // ── Step 4: Set checkout attempt to local_order_created ───────────────
    await db
      .update(checkoutAttempts)
      .set({ orderId: savedOrder.id, status: "local_order_created", lastCompletedStep: "local_order_created", updatedAt: new Date() })
      .where(eq(checkoutAttempts.id, attempt.id));

    // ── Step 5: Create placeholder payment record (status: "creating") ───
    // We create a placeholder payment record BEFORE calling Razorpay so that
    // we have a durable reference even if Razorpay creation succeeds but the
    // payment-row update fails.
    const placeholderProviderOrderId = `placeholder_${attempt.id}`;
    const [placeholderPayment] = await db
      .insert(payments)
      .values({
        orderId: savedOrder.id,
        providerOrderId: placeholderProviderOrderId,
        status: "created",
        amountPaise: grandTotalInclGstPaise,
      })
      .returning({ id: payments.id });

    // ── Step 6: Opportunistically cleanup expired reservations ───────────
    await cleanupExpiredReservationsBeforeCheckout(
      trustedLines.map((line) => ({ productId: line.product.id, quantity: line.quantity })),
    );

    // ── Step 7: Reserve inventory ─────────────────────────────────────────
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
      // Cleanup: cancel the order.
      await db.update(orders).set({ status: "cancelled", updatedAt: new Date() }).where(eq(orders.id, savedOrder.id));
      await db.update(payments).set({ status: "failed", updatedAt: new Date() }).where(eq(payments.id, placeholderPayment.id));
      await failCheckoutAttempt(db, attempt.id, message);
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

    // ── Step 7b: Set checkout attempt to inventory_reserved ──────────────
    await db
      .update(checkoutAttempts)
      .set({ status: "inventory_reserved", lastCompletedStep: "inventory_reserved", updatedAt: new Date() })
      .where(eq(checkoutAttempts.id, attempt.id));

    // ── Step 8: Set checkout attempt to provider_order_creating ───────────
    await db
      .update(checkoutAttempts)
      .set({ status: "provider_order_creating", lastCompletedStep: "provider_order_creating", updatedAt: new Date() })
      .where(eq(checkoutAttempts.id, attempt.id));

    // ── Step 9: Create Razorpay order ──────────────────────────────────────
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
      // Compensation: release inventory, cancel order, fail checkout attempt.
      await releaseReservationsForOrder(savedOrder.id, "razorpay_create_failed");
      await db.update(orders).set({ status: "cancelled", updatedAt: new Date() }).where(eq(orders.id, savedOrder.id));
      await db.update(payments).set({ status: "failed", updatedAt: new Date() }).where(eq(payments.id, placeholderPayment.id));
      await failCheckoutAttempt(db, attempt.id, message);
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

    // ── Step 10: Update payment record with providerOrderId ───────────────
    // Retry bounded times if this fails — don't return provider order ID
    // until durably stored.
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
          { event: "payment_update_retry", attempt: i + 1, orderId: savedOrder.id },
          "Retrying payment row update",
        );
        if (i === paymentUpdateAttempts - 1) {
          // Persistence failure — release reservations, cancel order, fail checkout.
          await releaseReservationsForOrder(savedOrder.id, "payment_row_update_failed");
          await db.update(orders).set({ status: "cancelled", updatedAt: new Date() }).where(eq(orders.id, savedOrder.id));
          await failCheckoutAttempt(db, attempt.id, "Failed to persist payment record");
          logger.error(
            { event: "payment_row_update_failed", orderId: savedOrder.id },
            "Payment row update failed after retries",
          );
          return {
            status: "failed",
            error: "Failed to finalize payment setup. Please retry.",
            retryable: true,
          };
        }
      }
    }

    // ── Step 11: Set checkout attempt to ready_for_checkout ───────────────
    await db
      .update(checkoutAttempts)
      .set({
        status: "ready_for_checkout",
        providerOrderId: razorpayOrder.id,
        lastCompletedStep: "ready_for_checkout",
        updatedAt: new Date(),
      })
      .where(eq(checkoutAttempts.id, attempt.id));

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
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    await failCheckoutAttempt(db, attempt.id, message);
    logger.error(
      { event: "checkout_orchestration_failed", idempotencyKey: input.idempotencyKey, error: message },
      "Checkout orchestration failed unexpectedly",
    );
    return { status: "failed", error: "An unexpected error occurred. Please retry.", retryable: true };
  }
}

// ─── Helper: fail checkout attempt ────────────────────────────────────────

async function failCheckoutAttempt(db: ReturnType<typeof getDb>, attemptId: string, error: string): Promise<void> {
  await db
    .update(checkoutAttempts)
    .set({ status: "failed", lastError: error.slice(0, 500), updatedAt: new Date() })
    .where(eq(checkoutAttempts.id, attemptId));
}

// ─── Helper: test mode checkout ───────────────────────────────────────────

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
