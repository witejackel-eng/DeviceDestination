import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyRazorpayWebhookSignature } from "@/lib/razorpay";
import { logger } from "@/lib/logger";
import { finalizeCapturedPayment } from "@/lib/payment-processing";

const webhookSchema = z.object({
  event: z.string(),
  payload: z.object({
    payment: z.object({
      entity: z.object({
        id: z.string(),
        order_id: z.string(),
        status: z.string(),
        amount: z.number().int().positive(),
      }),
    }),
  }),
});

/**
 * Razorpay webhook handler — thin adapter that:
 * 1. Reads raw request body
 * 2. Verifies Razorpay signature before trusting payload
 * 3. Validates payload via Zod
 * 4. Delegates ALL business logic to finalizeCapturedPayment
 * 5. Returns response based on durable local processing state
 */
export async function POST(request: Request) {
  const payload = await request.text();
  const signature = request.headers.get("x-razorpay-signature") ?? "";

  // ── Step 1: Verify Razorpay signature ───────────────────────────────────
  if (!verifyRazorpayWebhookSignature(payload, signature)) {
    logger.warn({ event: "invalid_webhook_signature" }, "Invalid Razorpay webhook signature");
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  }

  // ── Step 2: Parse and validate payload ──────────────────────────────────
  let body: unknown;
  try {
    body = JSON.parse(payload);
  } catch {
    return NextResponse.json({ error: "Malformed webhook payload." }, { status: 400 });
  }

  const parsed = webhookSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Unsupported webhook payload." }, { status: 400 });
  }

  const eventEntity = parsed.data.payload.payment.entity;
  const eventType = parsed.data.event;

  // ── Step 3: Handle payment.failed events ────────────────────────────────
  if (eventType === "payment.failed") {
    // For failed payments, we still delegate to the payment processing
    // service to record the event durably and handle cleanup.
    const eventId =
      request.headers.get("x-razorpay-event-id") ?? `${eventType}:${eventEntity.id}`;

    // Failed payments need simpler handling — mark the payment as failed
    // and release inventory. We use a simplified approach here since
    // finalizeCapturedPayment is designed for captured payments.
    // For failed payments, we record the event and handle cleanup.
    const { getDb, isDatabaseConfigured } = await import("@/db/client");
    if (!isDatabaseConfigured()) {
      return NextResponse.json({ error: "Order storage is unavailable." }, { status: 503 });
    }
    const db = getDb();
    const { payments, paymentWebhookEvents } = await import("@/db/schema");
    const { eq, sql } = await import("drizzle-orm");
    const { releaseReservationsForOrder } = await import("@/lib/inventory");

    // Record the webhook event durably.
    try {
      await db.insert(paymentWebhookEvents).values({
        provider: "razorpay",
        providerEventId: eventId,
        eventType: "payment.failed",
        providerOrderId: eventEntity.order_id,
        providerPaymentId: eventEntity.id,
        amountPaise: eventEntity.amount,
        processingStatus: "received",
      });
    } catch {
      // Duplicate event — already processed.
      logger.info({ event: "webhook_duplicate_failed", providerEventId: eventId }, "Duplicate payment.failed event");
    }

    // Find the payment record.
    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.providerOrderId, eventEntity.order_id))
      .limit(1);

    if (!payment) {
      return NextResponse.json({ received: true, matched: false });
    }

    // Amount mismatch check.
    if (eventEntity.amount !== payment.amountPaise) {
      logger.error(
        { event: "payment_amount_mismatch", providerOrderId: payment.providerOrderId },
        "Webhook amount did not match stored order",
      );
      return NextResponse.json({ error: "Payment amount mismatch." }, { status: 409 });
    }

    // Update payment to failed and release inventory.
    if (payment.status !== "failed" && payment.status !== "captured") {
      await db
        .update(payments)
        .set({
          status: "failed",
          providerPaymentId: eventEntity.id,
          rawEventId: eventId,
          updatedAt: new Date(),
        })
        .where(eq(payments.id, payment.id));

      await releaseReservationsForOrder(payment.orderId, "payment_failed");

      // Mark the webhook event as completed.
      await db
        .update(paymentWebhookEvents)
        .set({ processingStatus: "completed", completedAt: new Date(), updatedAt: new Date() })
        .where(eq(paymentWebhookEvents.providerEventId, eventId));
    }

    return NextResponse.json({ received: true, matched: true });
  }

  // ── Step 4: Handle payment.captured — delegate to payment processing ────
  if (eventType === "payment.captured") {
    const eventId =
      request.headers.get("x-razorpay-event-id") ?? `${eventType}:${eventEntity.id}`;

    const result = await finalizeCapturedPayment({
      providerOrderId: eventEntity.order_id,
      providerPaymentId: eventEntity.id,
      eventId,
      amountPaise: eventEntity.amount,
      eventType,
    });

    switch (result.status) {
      case "duplicate_completed":
        return NextResponse.json({ received: true, duplicate: true, orderId: result.orderId });
      case "accepted_processing":
        return NextResponse.json({ received: true, processing: true });
      case "completed":
        return NextResponse.json({ received: true, matched: true, orderId: result.orderId });
      case "failed":
        logger.error(
          { event: "webhook_processing_failed", providerEventId: eventId, error: result.error },
          "Webhook processing failed durably",
        );
        // Return 200 so Razorpay doesn't retry, but include the error for
        // our monitoring. The event is durably recorded for later recovery.
        return NextResponse.json({ received: true, error: result.error, retryViaReconciliation: true });
    }
  }

  // ── Step 5: Ignore other event types ────────────────────────────────────
  return NextResponse.json({ received: true, ignored: true });
}
