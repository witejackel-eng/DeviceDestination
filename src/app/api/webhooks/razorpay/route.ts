import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { verifyRazorpayWebhookSignature } from "@/lib/razorpay";
import { logger } from "@/lib/logger";
import { finalizeCapturedPayment } from "@/lib/payment-processing";
import { getDb, isDatabaseConfigured } from "@/db/client";
import { payments, paymentWebhookEvents } from "@/db/schema";

/**
 * Maximum webhook payload size. Razorpay payloads are typically < 10KB;
 * 1MB is a generous upper bound. Larger payloads are rejected before
 * signature verification to protect against denial-of-service.
 */
const MAX_WEBHOOK_PAYLOAD_BYTES = 1_024 * 1024;

/**
 * Razorpay webhook handler — durable ingestion pipeline.
 *
 * Pipeline:
 *   1. Read raw body.
 *   2. Validate payload size.
 *   3. Verify Razorpay signature BEFORE parsing or trusting data.
 *   4. Parse only required fields.
 *   5. Insert the event durably with atomic conflict handling.
 *   6. Execute idempotent processing.
 *   7. Mark it completed, ignored, retryable, or permanently failed.
 *   8. Preserve a safe error summary (never secrets or raw payloads).
 *
 * A database outage is NOT a duplicate. Unique-constraint violations are
 * duplicates; other insert errors are retryable.
 */
export async function POST(request: Request) {
  // ── Step 1: Read raw body with size limit ───────────────────────────────
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > MAX_WEBHOOK_PAYLOAD_BYTES) {
    return NextResponse.json({ error: "Payload too large." }, { status: 413 });
  }

  const payload = await request.text();
  if (payload.length > MAX_WEBHOOK_PAYLOAD_BYTES) {
    return NextResponse.json({ error: "Payload too large." }, { status: 413 });
  }

  const signature = request.headers.get("x-razorpay-signature") ?? "";

  // ── Step 2: Verify Razorpay signature BEFORE parsing ────────────────────
  if (!verifyRazorpayWebhookSignature(payload, signature)) {
    logger.warn({ event: "invalid_webhook_signature" }, "Invalid Razorpay webhook signature");
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  }

  // ── Step 3: Parse payload ────────────────────────────────────────────────
  let body: unknown;
  try {
    body = JSON.parse(payload);
  } catch {
    return NextResponse.json({ error: "Malformed webhook payload." }, { status: 400 });
  }

  const parsed = parseWebhookEvent(body);
  if (!parsed.ok) {
    // Unsupported event type or shape. Return 200 so Razorpay doesn't retry
    // — we intentionally ignore events we don't support.
    logger.info({ event: "webhook_ignored", reason: parsed.reason }, "Webhook event ignored");
    return NextResponse.json({ received: true, ignored: true, reason: parsed.reason });
  }

  const { eventType, providerOrderId, providerPaymentId, amountPaise, refundId } = parsed.data;
  const eventId =
    request.headers.get("x-razorpay-event-id") ?? `${eventType}:${providerPaymentId ?? refundId ?? providerOrderId}`;

  // ── Step 4: Durable event insert with proper error handling ──────────────
  if (!isDatabaseConfigured()) {
    logger.error({ event: "webhook_db_unconfigured", providerEventId: eventId }, "Database not configured for webhook");
    return NextResponse.json({ error: "Order storage is unavailable." }, { status: 503 });
  }
  const db = getDb();

  let eventRow: { id: string; processingStatus: string } | null = null;
  let isDuplicate = false;

  try {
    const [inserted] = await db
      .insert(paymentWebhookEvents)
      .values({
        provider: "razorpay",
        providerEventId: eventId,
        eventType,
        providerOrderId,
        providerPaymentId: providerPaymentId ?? null,
        amountPaise: amountPaise ?? null,
        processingStatus: "received",
      })
      .returning({ id: paymentWebhookEvents.id, processingStatus: paymentWebhookEvents.processingStatus });
    eventRow = inserted ?? null;
  } catch (error) {
    // Distinguish unique-constraint (duplicate) from other errors.
    if (isUniqueConstraintViolation(error)) {
      isDuplicate = true;
      const [existing] = await db
        .select({ id: paymentWebhookEvents.id, processingStatus: paymentWebhookEvents.processingStatus })
        .from(paymentWebhookEvents)
        .where(eq(paymentWebhookEvents.providerEventId, eventId))
        .limit(1);
      eventRow = existing ?? null;
      logger.info({ event: "webhook_duplicate", providerEventId: eventId }, "Duplicate webhook event received");
    } else {
      // A database outage is NOT a duplicate. Return 500 so Razorpay retries.
      logger.error(
        { event: "webhook_insert_failed", providerEventId: eventId, error: safeError(error) },
        "Failed to durably insert webhook event",
      );
      return NextResponse.json({ error: "Failed to store webhook event." }, { status: 500 });
    }
  }

  if (!eventRow) {
    logger.error({ event: "webhook_event_row_missing", providerEventId: eventId }, "Webhook event row not found after insert");
    return NextResponse.json({ error: "Webhook event could not be stored." }, { status: 500 });
  }

  // If the event is already completed, return success (confirmed duplicate).
  if (isDuplicate && (eventRow.processingStatus === "completed" || eventRow.processingStatus === "ignored")) {
    return NextResponse.json({ received: true, duplicate: true, status: eventRow.processingStatus });
  }

  // ── Step 5: Atomically claim the event for processing ───────────────────
  const claimed = await db
    .update(paymentWebhookEvents)
    .set({
      processingStatus: "processing",
      processingStartedAt: new Date(),
      attempts: sql`${paymentWebhookEvents.attempts} + 1`,
      updatedAt: new Date(),
    })
    .where(
      sql`${paymentWebhookEvents.id} = ${eventRow.id}
          AND ${paymentWebhookEvents.processingStatus} IN ('received', 'failed')`,
    )
    .returning({ id: paymentWebhookEvents.id });

  if (claimed.length === 0) {
    // Another worker is already processing this event. Return success —
    // the event is durably stored and will be processed.
    return NextResponse.json({ received: true, processing: true, duplicate: isDuplicate });
  }

  // ── Step 6: Execute idempotent processing ───────────────────────────────
  try {
    const outcome = await processWebhookEvent(eventType, {
      providerOrderId,
      providerPaymentId,
      amountPaise,
      refundId,
      eventId,
    });

    // ── Step 7: Mark the event with the outcome ────────────────────────────
    // Map outcome status to DB status. `retryable` maps to `failed` in the
    // DB (the distinction is the HTTP response code, not the DB status).
    const dbStatus = outcome.status === "retryable" ? "failed" : outcome.status;
    await db
      .update(paymentWebhookEvents)
      .set({
        processingStatus: dbStatus,
        completedAt: dbStatus === "completed" || dbStatus === "ignored" ? new Date() : null,
        lastError: "error" in outcome ? outcome.error : null,
        updatedAt: new Date(),
      })
      .where(eq(paymentWebhookEvents.id, eventRow.id));

    // ── Step 8: Return appropriate response ────────────────────────────────
    if (outcome.status === "completed" || outcome.status === "ignored") {
      return NextResponse.json({ received: true, status: outcome.status });
    }
    if (outcome.status === "failed") {
      // Permanently failed — return 200 so Razorpay doesn't retry endlessly.
      // The event is durably stored for manual review.
      logger.error(
        { event: "webhook_permanently_failed", providerEventId: eventId, error: outcome.error },
        "Webhook event permanently failed",
      );
      return NextResponse.json({ received: true, status: "failed", error: outcome.error });
    }
    // Retryable failure — return 500 so Razorpay retries.
    logger.warn(
      { event: "webhook_retryable_failure", providerEventId: eventId, error: outcome.error },
      "Webhook event failed (retryable)",
    );
    return NextResponse.json({ error: "Retryable processing failure.", received: true }, { status: 500 });
  } catch (error) {
    // Unexpected error during processing. Mark the event as failed (retryable).
    const safeMessage = safeError(error);
    await db
      .update(paymentWebhookEvents)
      .set({
        processingStatus: "failed",
        lastError: safeMessage,
        updatedAt: new Date(),
      })
      .where(eq(paymentWebhookEvents.id, eventRow.id));
    logger.error(
      { event: "webhook_unexpected_error", providerEventId: eventId, error: safeMessage },
      "Unexpected error during webhook processing",
    );
    return NextResponse.json({ error: "Unexpected processing error." }, { status: 500 });
  }
}

// ─── Event processing ──────────────────────────────────────────────────────

type WebhookOutcome =
  | { status: "completed" }
  | { status: "ignored" }
  | { status: "failed"; error: string }
  | { status: "retryable"; error: string };

async function processWebhookEvent(
  eventType: string,
  data: {
    providerOrderId: string;
    providerPaymentId?: string;
    amountPaise?: number;
    refundId?: string;
    eventId: string;
  },
): Promise<WebhookOutcome> {
  // ── payment.captured ─────────────────────────────────────────────────────
  if (eventType === "payment.captured") {
    const result = await finalizeCapturedPayment({
      providerOrderId: data.providerOrderId,
      providerPaymentId: data.providerPaymentId!,
      eventId: data.eventId,
      amountPaise: data.amountPaise!,
      eventType,
    });
    switch (result.status) {
      case "completed":
      case "duplicate_completed":
        return { status: "completed" };
      case "failed":
        return { status: "failed", error: result.error ?? "Payment finalization failed" };
      default:
        return { status: "retryable", error: "Payment finalization incomplete" };
    }
  }

  // ── payment.failed ───────────────────────────────────────────────────────
  if (eventType === "payment.failed") {
    return handleFailedPayment(data);
  }

  // ── refund.* events ─────────────────────────────────────────────────────
  if (eventType.startsWith("refund.")) {
    return handleRefundEvent(eventType, data);
  }

  // ── payment.authorized — ignore, wait for capture ───────────────────────
  if (eventType === "payment.authorized") {
    return { status: "ignored" };
  }

  // ── Unknown event type — ignore ─────────────────────────────────────────
  return { status: "ignored" };
}

async function handleFailedPayment(data: {
  providerOrderId: string;
  providerPaymentId?: string;
  amountPaise?: number;
  eventId: string;
}): Promise<WebhookOutcome> {
  const db = getDb();
  const { releaseReservationsForOrder } = await import("@/lib/inventory");

  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.providerOrderId, data.providerOrderId))
    .limit(1);

  if (!payment) {
    // No matching payment — not an error, just nothing to do.
    return { status: "completed" };
  }

  // Amount mismatch check.
  if (data.amountPaise !== undefined && data.amountPaise !== payment.amountPaise) {
    logger.error(
      { event: "payment_amount_mismatch", providerOrderId: payment.providerOrderId, expected: payment.amountPaise, received: data.amountPaise },
      "Webhook amount did not match stored order",
    );
    return { status: "failed", error: "Amount mismatch" };
  }

  // Update payment to failed and release inventory — but only if not already
  // captured (never change a captured payment).
  if (payment.status !== "failed" && payment.status !== "captured") {
    await db
      .update(payments)
      .set({
        status: "failed",
        providerPaymentId: data.providerPaymentId ?? payment.providerPaymentId,
        rawEventId: data.eventId,
        updatedAt: new Date(),
      })
      .where(eq(payments.id, payment.id));

    await releaseReservationsForOrder(payment.orderId, "payment_failed");
  }

  return { status: "completed" };
}

async function handleRefundEvent(
  eventType: string,
  data: {
    providerOrderId: string;
    providerPaymentId?: string;
    refundId?: string;
    eventId: string;
  },
): Promise<WebhookOutcome> {
  const { processRefundWebhook } = await import("@/lib/refunds");
  try {
    const result = await processRefundWebhook({
      eventType,
      providerPaymentId: data.providerPaymentId,
      refundId: data.refundId,
      eventId: data.eventId,
    });
    if (result.status === "completed" || result.status === "ignored") {
      return { status: result.status };
    }
    return { status: result.status, error: result.error ?? "Refund processing failed" };
  } catch (error) {
    return { status: "retryable", error: safeError(error) };
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

type ParsedWebhook =
  | {
      ok: true;
      data: {
        eventType: string;
        providerOrderId: string;
        providerPaymentId?: string;
        amountPaise?: number;
        refundId?: string;
      };
    }
  | { ok: false; reason: string };

function parseWebhookEvent(body: unknown): ParsedWebhook {
  if (typeof body !== "object" || body === null) {
    return { ok: false, reason: "not_an_object" };
  }
  const obj = body as Record<string, unknown>;
  const eventType = obj.event;
  if (typeof eventType !== "string") {
    return { ok: false, reason: "no_event_field" };
  }

  // Payment events have payload.payment.entity
  if (eventType.startsWith("payment.")) {
    const entity = path(obj, ["payload", "payment", "entity"]);
    if (typeof entity !== "object" || entity === null) {
      return { ok: false, reason: "no_payment_entity" };
    }
    const e = entity as Record<string, unknown>;
    const providerOrderId = e.order_id;
    const providerPaymentId = e.id;
    const amountPaise = e.amount;
    if (typeof providerOrderId !== "string" || typeof providerPaymentId !== "string") {
      return { ok: false, reason: "missing_payment_fields" };
    }
    return {
      ok: true,
      data: {
        eventType,
        providerOrderId,
        providerPaymentId,
        amountPaise: typeof amountPaise === "number" ? amountPaise : undefined,
      },
    };
  }

  // Refund events have payload.refund.entity
  if (eventType.startsWith("refund.")) {
    const entity = path(obj, ["payload", "refund", "entity"]);
    if (typeof entity !== "object" || entity === null) {
      return { ok: false, reason: "no_refund_entity" };
    }
    const e = entity as Record<string, unknown>;
    const refundId = e.id;
    const providerPaymentId = e.payment_id;
    const providerOrderId = e.order_id;
    if (typeof refundId !== "string") {
      return { ok: false, reason: "missing_refund_fields" };
    }
    return {
      ok: true,
      data: {
        eventType,
        providerOrderId: typeof providerOrderId === "string" ? providerOrderId : "",
        providerPaymentId: typeof providerPaymentId === "string" ? providerPaymentId : undefined,
        refundId,
      },
    };
  }

  return { ok: false, reason: `unsupported_event:${eventType}` };
}

function path(obj: unknown, keys: string[]): unknown {
  let cur: unknown = obj;
  for (const k of keys) {
    if (typeof cur !== "object" || cur === null) return undefined;
    cur = (cur as Record<string, unknown>)[k];
  }
  return cur;
}

function isUniqueConstraintViolation(error: unknown): boolean {
  if (error && typeof error === "object") {
    const code = (error as { code?: string }).code;
    const constraint = (error as { constraint?: string }).constraint;
    // PostgreSQL unique violation: 23505. Drizzle/pg may surface this as
    // either `code` or `constraint`.
    return code === "23505" || (typeof constraint === "string" && constraint.includes("provider_event_id"));
  }
  return false;
}

function safeError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  // Truncate and strip anything that looks like a secret.
  return msg
    .replace(/(sk_|sk_test_|rk_|rk_test_|ghp_|gho_|Bearer )\S+/gi, "[redacted]")
    .slice(0, 500);
}
