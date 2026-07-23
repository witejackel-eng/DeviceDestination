/**
 * Central idempotent payment processing service.
 *
 * Each step is independently idempotent — a retry can complete only the
 * missing steps by checking the timestamps on the payment record.
 * The neon-http driver does NOT support interactive transactions with row
 * locks, so all atomic operations use conditional UPDATEs with RETURNING.
 */

import { and, eq, sql } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/db/client";
import {
  inventoryReservations,
  orderItems,
  orders,
  payments,
  paymentWebhookEvents,
} from "@/db/schema";
import { logger } from "@/lib/logger";
import { consumeReservationsForOrder, reserveInventoryForOrder } from "@/lib/inventory";
import { enqueueDeduplicatedJob, type JobType } from "@/lib/jobs";
import { assertTransition, type OrderStatus } from "@/lib/order-state";

// ─── Types ────────────────────────────────────────────────────────────────

export type FinalizeResult =
  | { status: "duplicate_completed"; eventId: string; orderId: string }
  | { status: "accepted_processing"; eventId: string }
  | { status: "completed"; eventId: string; orderId: string }
  | { status: "failed"; eventId: string; error: string };

// ─── Main entry point ────────────────────────────────────────────────────

export async function finalizeCapturedPayment(input: {
  providerOrderId: string;
  providerPaymentId: string;
  eventId: string;
  amountPaise: number;
  eventType: string;
}): Promise<FinalizeResult> {
  if (!isDatabaseConfigured()) {
    return { status: "failed", eventId: input.eventId, error: "Database is not configured" };
  }
  const db = getDb();
  const now = new Date();

  // ── Step 1: Persist/resolve webhook event ──────────────────────────────
  // Try to insert the event. If the providerEventId already exists, we
  // look up the existing row and decide what to return.
  let eventRow: typeof paymentWebhookEvents.$inferSelect | undefined;
  try {
    const [inserted] = await db
      .insert(paymentWebhookEvents)
      .values({
        provider: "razorpay",
        providerEventId: input.eventId,
        eventType: input.eventType,
        providerOrderId: input.providerOrderId,
        providerPaymentId: input.providerPaymentId,
        amountPaise: input.amountPaise,
        processingStatus: "received",
        receivedAt: now,
        updatedAt: now,
      })
      .returning();
    eventRow = inserted;
  } catch {
    // Unique conflict on providerEventId — look up the existing event.
    const [existing] = await db
      .select()
      .from(paymentWebhookEvents)
      .where(eq(paymentWebhookEvents.providerEventId, input.eventId))
      .limit(1);
    eventRow = existing;
  }

  if (!eventRow) {
    return { status: "failed", eventId: input.eventId, error: "Could not persist or resolve webhook event" };
  }

  // ── Step 2: If event already completed → duplicate ─────────────────────
  if (eventRow.processingStatus === "completed" || eventRow.processingStatus === "ignored") {
    // Look up the payment/order to return useful context.
    const [payment] = await db
      .select({ orderId: payments.orderId })
      .from(payments)
      .where(eq(payments.providerOrderId, input.providerOrderId))
      .limit(1);
    logger.info(
      { event: "webhook_duplicate", providerEventId: input.eventId, processingStatus: eventRow.processingStatus },
      "Webhook event already processed — returning duplicate_completed",
    );
    return {
      status: "duplicate_completed",
      eventId: eventRow.id,
      orderId: payment?.orderId ?? "",
    };
  }

  // ── Step 3: If event is currently being processed → accepted ───────────
  if (eventRow.processingStatus === "processing") {
    logger.info(
      { event: "webhook_already_processing", providerEventId: input.eventId },
      "Webhook event is currently being processed — returning accepted_processing",
    );
    return { status: "accepted_processing", eventId: eventRow.id };
  }

  // ── Step 4: Atomically claim the event for processing ──────────────────
  // received → processing (or failed → processing for retry)
  const claimed = await db
    .update(paymentWebhookEvents)
    .set({
      processingStatus: "processing",
      processingStartedAt: now,
      attempts: sql`${paymentWebhookEvents.attempts} + 1`,
      updatedAt: now,
    })
    .where(
      and(
        eq(paymentWebhookEvents.id, eventRow.id),
        sql`${paymentWebhookEvents.processingStatus} IN ('received', 'failed')`,
      ),
    )
    .returning({ id: paymentWebhookEvents.id });

  if (claimed.length === 0) {
    // Another worker claimed it between our read and our write.
    logger.info(
      { event: "webhook_claim_lost", providerEventId: input.eventId },
      "Could not claim webhook event — returning accepted_processing",
    );
    return { status: "accepted_processing", eventId: eventRow.id };
  }

  // ── Step 5–11: Process the payment, each step idempotent ───────────────
  try {
    const result = await processPaymentSteps(input);
    // Mark event completed or ignored
    if (result.kind === "ignored") {
      await db
        .update(paymentWebhookEvents)
        .set({ processingStatus: "ignored", completedAt: new Date(), updatedAt: new Date() })
        .where(eq(paymentWebhookEvents.id, eventRow.id));
      return { status: "duplicate_completed", eventId: eventRow.id, orderId: result.orderId };
    }
    await db
      .update(paymentWebhookEvents)
      .set({ processingStatus: "completed", completedAt: new Date(), updatedAt: new Date() })
      .where(eq(paymentWebhookEvents.id, eventRow.id));
    return { status: "completed", eventId: eventRow.id, orderId: result.orderId };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error).slice(0, 500);
    await db
      .update(paymentWebhookEvents)
      .set({ processingStatus: "failed", lastError: message, updatedAt: new Date() })
      .where(eq(paymentWebhookEvents.id, eventRow.id));
    logger.error(
      { event: "payment_processing_failed", providerEventId: input.eventId, error: message },
      "Payment processing failed",
    );
    return { status: "failed", eventId: eventRow.id, error: message };
  }
}

// ─── Idempotent processing steps ──────────────────────────────────────────

async function processPaymentSteps(input: {
  providerOrderId: string;
  providerPaymentId: string;
  eventId: string;
  amountPaise: number;
  eventType: string;
}): Promise<{ kind: "processed"; orderId: string } | { kind: "ignored"; orderId: string }> {
  const db = getDb();

  // Find the payment record for this provider order.
  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.providerOrderId, input.providerOrderId))
    .limit(1);

  if (!payment) {
    throw new Error(`No payment record found for provider order ${input.providerOrderId}`);
  }

  // If already captured and processing completed, this is an ignored duplicate.
  if (payment.processingCompletedAt) {
    return { kind: "ignored", orderId: payment.orderId };
  }

  // ── Step 5: Record provider payment capture idempotently ───────────────
  if (!payment.captureRecordedAt) {
    // Verify amount matches.
    if (input.amountPaise !== payment.amountPaise) {
      throw new Error(
        `Amount mismatch: webhook ${input.amountPaise} vs stored ${payment.amountPaise}`,
      );
    }
    await db
      .update(payments)
      .set({
        status: "captured",
        providerPaymentId: input.providerPaymentId,
        rawEventId: input.eventId,
        captureRecordedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(payments.id, payment.id));
    logger.info(
      { event: "payment_capture_recorded", providerOrderId: input.providerOrderId },
      "Payment capture recorded idempotently",
    );
  }

  // ── Step 6: Mark order paid through central order state ─────────────────
  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.id, payment.orderId))
    .limit(1);

  if (!order) {
    throw new Error(`Order ${payment.orderId} not found`);
  }

  if (!payment.orderPaidMarkedAt) {
    if (order.status !== "paid" && order.status !== "inventory_exception") {
      assertTransition(order.status as OrderStatus, "paid");
      await db
        .update(orders)
        .set({ status: "paid", updatedAt: new Date() })
        .where(eq(orders.id, order.id));
    }
    await db
      .update(payments)
      .set({ orderPaidMarkedAt: new Date(), updatedAt: new Date() })
      .where(eq(payments.id, payment.id));
    logger.info(
      { event: "order_paid_marked", orderId: payment.orderId },
      "Order marked paid idempotently",
    );
  }

  // ── Step 7: Handle inventory — consume or handle reservation expiry ─────
  if (!payment.inventoryConsumedAt) {
    // Check current reservation state for this order.
    const activeReservations = await db
      .select()
      .from(inventoryReservations)
      .where(
        and(
          eq(inventoryReservations.orderId, payment.orderId),
          sql`${inventoryReservations.status} IN ('pending', 'active', 'consuming')`,
        ),
      );

    if (activeReservations.length > 0) {
      // Reservations exist — consume them.
      await consumeReservationsForOrder(payment.orderId);
    } else {
      // No active reservations — they may have expired. Try fresh allocation.
      const items = await db
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, payment.orderId));

      if (items.length === 0) {
        throw new Error(`No order items found for order ${payment.orderId}`);
      }

      try {
        await reserveInventoryForOrder({
          orderId: payment.orderId,
          items: items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
          })),
        });
        // Reservation succeeded — now consume.
        await consumeReservationsForOrder(payment.orderId);
      } catch (reserveError) {
        // Insufficient stock after reservation expiry.
        const message = reserveError instanceof Error ? reserveError.message : "unknown";
        logger.error(
          { event: "inventory_exception", orderId: payment.orderId, error: message },
          "Insufficient stock after reservation expiry — setting inventory_exception",
        );
        // Mark order as inventory_exception — don't silently oversell.
        await db
          .update(orders)
          .set({
            status: "inventory_exception",
            fulfilmentHoldReason: `Insufficient stock after reservation expiry: ${message}`,
            updatedAt: new Date(),
          })
          .where(eq(orders.id, payment.orderId));
        // Enqueue admin alert job for manual resolution.
        await enqueueDeduplicatedJob({
          type: "send-order-email" as JobType,
          payload: { orderId: payment.orderId, alertType: "inventory_exception" },
          dedupeKey: `admin-alert:inventory_exception:${payment.orderId}`,
        });
        // Don't throw — we still want to mark processing steps that were completed.
        // But we skip inventory consumption step.
        // Note: inventoryConsumedAt will remain null, which is correct —
        // admin must resolve this before inventory is actually consumed.
      }
    }

    // Only set inventoryConsumedAt if we actually consumed inventory
    // (not in the inventory_exception case).
    const [updatedOrder] = await db
      .select({ status: orders.status })
      .from(orders)
      .where(eq(orders.id, payment.orderId))
      .limit(1);

    if (updatedOrder?.status !== "inventory_exception") {
      await db
        .update(payments)
        .set({ inventoryConsumedAt: new Date(), updatedAt: new Date() })
        .where(eq(payments.id, payment.id));
    }
  }

  // ── Step 8 was handled above (inventory consumption) ────────────────────

  // ── Step 9: Enqueue deduplicated invoice, email, WhatsApp jobs ──────────
  if (!payment.invoiceJobQueuedAt) {
    await enqueueDeduplicatedJob({
      type: "generate-invoice",
      payload: { orderId: payment.orderId },
      dedupeKey: `generate-invoice:${payment.orderId}`,
    });
    await db
      .update(payments)
      .set({ invoiceJobQueuedAt: new Date(), updatedAt: new Date() })
      .where(eq(payments.id, payment.id));
  }

  if (!payment.emailJobQueuedAt) {
    await enqueueDeduplicatedJob({
      type: "send-order-email",
      payload: { orderId: payment.orderId },
      dedupeKey: `send-order-email:${payment.orderId}`,
    });
    await db
      .update(payments)
      .set({ emailJobQueuedAt: new Date(), updatedAt: new Date() })
      .where(eq(payments.id, payment.id));
  }

  if (!payment.whatsappJobQueuedAt) {
    await enqueueDeduplicatedJob({
      type: "send-order-whatsapp",
      payload: { orderId: payment.orderId },
      dedupeKey: `send-order-whatsapp:${payment.orderId}`,
    });
    await db
      .update(payments)
      .set({ whatsappJobQueuedAt: new Date(), updatedAt: new Date() })
      .where(eq(payments.id, payment.id));
  }

  // ── Step 10: Mark payment processing completed ──────────────────────────
  if (!payment.processingCompletedAt) {
    await db
      .update(payments)
      .set({ processingCompletedAt: new Date(), updatedAt: new Date() })
      .where(eq(payments.id, payment.id));
    logger.info(
      { event: "payment_processing_completed", orderId: payment.orderId },
      "Payment processing completed",
    );
  }

  return { kind: "processed", orderId: payment.orderId };
}
