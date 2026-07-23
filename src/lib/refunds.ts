import { and, eq, gte, lte, sql, sum } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/db/client";
import { orders, payments, refunds } from "@/db/schema";
import { getRazorpay } from "@/lib/razorpay";
import { isRazorpayConfigured } from "@/lib/env";
import { logger } from "@/lib/logger";
import { createHash, randomUUID } from "node:crypto";
import type { refundStatus } from "@/db/schema";

export type RefundStatusValue = (typeof refundStatus.enumValues)[number];

export class RefundError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "RefundError";
  }
}

/**
 * Create an idempotency key for a refund request. Combines the payment ID,
 * amount, and an actor salt so that repeated requests for the same refund
 * produce the same key.
 */
export function refundIdempotencyKey(input: {
  paymentId: string;
  amountPaise: number;
  actorUserId: string;
}): string {
  return createHash("sha256")
    .update(`${input.paymentId}:${input.amountPaise}:${input.actorUserId}`)
    .digest("hex");
}

/**
 * Compute the total refund amount already recorded against a payment. Used to
 * prevent excess refunds.
 */
export async function getTotalRefundedForPayment(paymentId: string): Promise<number> {
  if (!isDatabaseConfigured()) return 0;
  const db = getDb();
  const rows = await db
    .select({ total: sum(refunds.amountPaise) })
    .from(refunds)
    .where(
      and(
        eq(refunds.paymentId, paymentId),
        sql`${refunds.status} IN ('pending', 'processing', 'processed')`,
      ),
    );
  const total = Number(rows[0]?.total ?? 0);
  return Number.isFinite(total) ? total : 0;
}

/**
 * Validate that a refund request is permissible:
 *  - Order must exist
 *  - Payment must be captured (or partially refunded)
 *  - Amount must be positive
 *  - Total refunds for this payment must not exceed captured amount
 */
export async function validateRefundRequest(input: {
  orderId: string;
  amountPaise: number;
  reason: string;
}): Promise<{ paymentId: string; providerPaymentId: string; capturedAmountPaise: number }> {
  if (!isDatabaseConfigured()) {
    throw new RefundError("Database is not configured", "db_unconfigured");
  }
  if (input.amountPaise <= 0) {
    throw new RefundError("Refund amount must be positive", "invalid_amount");
  }
  if (input.reason.trim().length === 0) {
    throw new RefundError("Refund reason is required", "missing_reason");
  }
  const db = getDb();
  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.orderId, input.orderId))
    .limit(1);
  if (!payment) {
    throw new RefundError("No payment record for this order", "no_payment");
  }
  if (payment.status !== "captured" && payment.status !== "refunded") {
    throw new RefundError(
      `Payment is in status ${payment.status}; only captured payments can be refunded`,
      "payment_not_captured",
    );
  }
  if (!payment.providerPaymentId) {
    throw new RefundError("Provider payment ID is missing", "no_provider_payment_id");
  }
  const alreadyRefunded = await getTotalRefundedForPayment(payment.id);
  const capturedAmount = payment.amountPaise;
  if (alreadyRefunded + input.amountPaise > capturedAmount) {
    throw new RefundError(
      `Refund total (${alreadyRefunded + input.amountPaise}) would exceed captured amount (${capturedAmount})`,
      "excess_refund",
    );
  }
  return {
    paymentId: payment.id,
    providerPaymentId: payment.providerPaymentId,
    capturedAmountPaise: capturedAmount,
  };
}

/**
 * Create a refund record. If Razorpay is not configured, the refund is
 * recorded with status `pending` for an authorized admin to process manually
 * once credentials are activated. Idempotency: if a refund with the same
 * idempotency key already exists, returns it without re-calling the provider.
 */
export async function createRefund(input: {
  orderId: string;
  amountPaise: number;
  reason: string;
  actorUserId: string;
  actorEmail?: string;
}): Promise<{ refundId: string; status: RefundStatusValue; idempotent: boolean }> {
  const validation = await validateRefundRequest({
    orderId: input.orderId,
    amountPaise: input.amountPaise,
    reason: input.reason,
  });
  const idempotencyKey = refundIdempotencyKey({
    paymentId: validation.paymentId,
    amountPaise: input.amountPaise,
    actorUserId: input.actorUserId,
  });

  if (!isDatabaseConfigured()) {
    throw new RefundError("Database is not configured", "db_unconfigured");
  }
  const db = getDb();

  // Idempotency check.
  const [existing] = await db
    .select()
    .from(refunds)
    .where(eq(refunds.idempotencyKey, idempotencyKey))
    .limit(1);
  if (existing) {
    return { refundId: existing.id, status: existing.status, idempotent: true };
  }

  // Insert the refund record in `pending` state.
  const [refund] = await db
    .insert(refunds)
    .values({
      orderId: input.orderId,
      paymentId: validation.paymentId,
      amountPaise: input.amountPaise,
      reason: input.reason,
      status: "pending",
      requestedBy: input.actorUserId,
      idempotencyKey,
    })
    .returning({ id: refunds.id, status: refunds.status });

  // If Razorpay is not configured, leave the refund in `pending` state.
  if (!isRazorpayConfigured()) {
    logger.warn(
      { event: "refund_pending_unconfigured", refundId: refund.id, orderId: input.orderId },
      "Refund recorded but Razorpay is not configured — pending manual processing",
    );
    return { refundId: refund.id, status: "pending", idempotent: false };
  }

  // Attempt to process via Razorpay immediately. Failures are stored as
  // `failed` for admin retry — never silently rolled back.
  try {
    await db
      .update(refunds)
      .set({ status: "processing", updatedAt: new Date() })
      .where(eq(refunds.id, refund.id));
    const providerRefund = await getRazorpay().payments.refund(validation.providerPaymentId, {
      amount: input.amountPaise,
      notes: {
        reason: input.reason.slice(0, 200),
        actor: input.actorEmail ?? input.actorUserId,
      },
    });
    const providerStatus = String(providerRefund.status ?? "pending").toLowerCase();
    const finalStatus: RefundStatusValue =
      providerStatus === "processed" || providerStatus === "created"
        ? "processed"
        : providerStatus === "failed"
          ? "failed"
          : "processing";
    await db
      .update(refunds)
      .set({
        status: finalStatus,
        providerRefundId: String(providerRefund.id ?? null),
        providerResponse: providerRefund as unknown as Record<string, unknown>,
        processedAt: finalStatus === "processed" ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(refunds.id, refund.id));
    return { refundId: refund.id, status: finalStatus, idempotent: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    await db
      .update(refunds)
      .set({
        status: "failed",
        failureReason: message.slice(0, 500),
        updatedAt: new Date(),
      })
      .where(eq(refunds.id, refund.id));
    logger.error(
      { event: "refund_failed", refundId: refund.id, orderId: input.orderId, error: message },
      "Refund provider call failed",
    );
    return { refundId: refund.id, status: "failed", idempotent: false };
  }
}

/**
 * Compute the aggregate refund status for an order. Updates the order's
 * `refundTotalPaise` field. Does NOT auto-transition order state — the admin
 * must explicitly mark the order as `refunded` after reviewing.
 */
export async function recomputeOrderRefundTotal(orderId: string): Promise<{
  refundTotalPaise: number;
  capturedAmountPaise: number;
  fullyRefunded: boolean;
}> {
  if (!isDatabaseConfigured()) {
    return { refundTotalPaise: 0, capturedAmountPaise: 0, fullyRefunded: false };
  }
  const db = getDb();
  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.orderId, orderId))
    .limit(1);
  if (!payment) return { refundTotalPaise: 0, capturedAmountPaise: 0, fullyRefunded: false };
  const totalRefunded = await getTotalRefundedForPayment(payment.id);
  await db
    .update(orders)
    .set({ refundTotalPaise: totalRefunded, updatedAt: new Date() })
    .where(eq(orders.id, orderId));
  return {
    refundTotalPaise: totalRefunded,
    capturedAmountPaise: payment.amountPaise,
    fullyRefunded: totalRefunded >= payment.amountPaise && payment.amountPaise > 0,
  };
}
