import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, isDatabaseConfigured } from "@/db/client";
import { orders, payments } from "@/db/schema";
import { createOrderConfirmationToken } from "@/lib/order-token";
import {
  getRazorpay,
  validateRazorpayPaymentRecord,
  verifyRazorpayPaymentSignature,
} from "@/lib/razorpay";
import { logger } from "@/lib/logger";
import { checkRateLimit, rateLimitHeaders, getClientIP } from "@/lib/rate-limit";

const schema = z.object({
  orderNumber: z.string().startsWith("DD-").max(40),
  razorpayOrderId: z.string().min(1).max(120),
  razorpayPaymentId: z.string().min(1).max(120),
  signature: z.string().min(20).max(256),
});

/**
 * Explicit payment confirmation states returned to the browser.
 *
 * Only `captured` means final payment success. The browser must NOT clear
 * the cart or display final success for any other state.
 */
type PaymentConfirmationState =
  | "captured"
  | "authorized_pending_capture"
  | "pending_webhook"
  | "pending_reconciliation"
  | "failed"
  | "mismatch";

export async function POST(request: Request) {
  const ip = getClientIP(request);

  // ── Rate limit by IP ────────────────────────────────────────────────────
  const ipLimit = await checkRateLimit("payment_verify", ip);
  if (!ipLimit.success) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429, headers: rateLimitHeaders(ipLimit) },
    );
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payment response." }, { status: 400 });
  }

  // ── Rate limit by order (prevents enumeration) ──────────────────────────
  const orderLimit = await checkRateLimit("payment_verify_per_order", parsed.data.orderNumber);
  if (!orderLimit.success) {
    return NextResponse.json(
      { error: "Too many verification attempts for this order. Please wait." },
      { status: 429, headers: rateLimitHeaders(orderLimit) },
    );
  }

  // ── Rate limit by payment ID (prevents enumeration) ─────────────────────
  const paymentLimit = await checkRateLimit("payment_verify_per_payment", parsed.data.razorpayPaymentId);
  if (!paymentLimit.success) {
    return NextResponse.json(
      { error: "Too many verification attempts for this payment. Please wait." },
      { status: 429, headers: rateLimitHeaders(paymentLimit) },
    );
  }

  // ── Signature verification ──────────────────────────────────────────────
  const verified = verifyRazorpayPaymentSignature(
    parsed.data.razorpayOrderId,
    parsed.data.razorpayPaymentId,
    parsed.data.signature,
  );
  if (!verified) {
    logger.warn(
      { event: "invalid_payment_signature", orderNumber: parsed.data.orderNumber },
      "Invalid payment signature",
    );
    return NextResponse.json({ error: "Payment verification failed." }, { status: 400 });
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Order storage is unavailable." }, { status: 503 });
  }

  const db = getDb();
  const match = await db
    .select({
      paymentId: payments.id,
      orderId: orders.id,
      amountPaise: payments.amountPaise,
      paymentStatus: payments.status,
    })
    .from(payments)
    .innerJoin(orders, eq(orders.id, payments.orderId))
    .where(
      and(
        eq(payments.providerOrderId, parsed.data.razorpayOrderId),
        eq(orders.orderNumber, parsed.data.orderNumber),
      ),
    )
    .limit(1);

  if (!match[0]) {
    return NextResponse.json({ error: "Order record not found." }, { status: 404 });
  }

  // ── If already captured, return captured state ──────────────────────────
  if (match[0].paymentStatus === "captured") {
    return NextResponse.json({
      verified: true,
      state: "captured" as PaymentConfirmationState,
      orderNumber: parsed.data.orderNumber,
      confirmationToken: createOrderConfirmationToken(parsed.data.orderNumber),
    });
  }

  // ── Fetch the provider payment record ───────────────────────────────────
  let providerPayment: { status?: string; amount?: string | number; order_id?: string };
  try {
    providerPayment = await getRazorpay().payments.fetch(parsed.data.razorpayPaymentId);
  } catch (error) {
    logger.error(
      { event: "provider_payment_fetch_failed", orderNumber: parsed.data.orderNumber, error: error instanceof Error ? error.message : "unknown" },
      "Failed to fetch provider payment record",
    );
    // Return pending_reconciliation — the webhook or cron will resolve this.
    return NextResponse.json({
      verified: true,
      state: "pending_reconciliation" as PaymentConfirmationState,
      orderNumber: parsed.data.orderNumber,
      message: "Payment is being confirmed. Please do not pay again. We will notify you when confirmation is complete.",
    });
  }

  // ── Validate the provider payment record ────────────────────────────────
  const providerValid = validateRazorpayPaymentRecord({
    expectedOrderId: parsed.data.razorpayOrderId,
    expectedAmountPaise: match[0].amountPaise,
    providerOrderId: providerPayment.order_id ?? parsed.data.razorpayOrderId,
    providerAmountPaise: Number(providerPayment.amount),
    providerStatus: providerPayment.status ?? "unknown",
  });

  if (!providerValid) {
    logger.error(
      {
        event: "payment_record_mismatch",
        orderNumber: parsed.data.orderNumber,
        providerStatus: providerPayment.status,
      },
      "Provider payment did not match the stored order",
    );
    return NextResponse.json(
      {
        verified: false,
        state: "mismatch" as PaymentConfirmationState,
        error: "Payment details do not match this order. Do not pay again; contact support.",
      },
      { status: 409 },
    );
  }

  // ── Determine the explicit payment state ────────────────────────────────
  const providerStatus = String(providerPayment.status ?? "unknown").toLowerCase();

  if (providerStatus === "captured") {
    // The provider says captured. But we should NOT claim final success
    // until it's persisted locally AND the webhook has confirmed. Mark as
    // pending_webhook — the webhook will move it to captured.
    await db
      .update(payments)
      .set({
        providerPaymentId: parsed.data.razorpayPaymentId,
        status: "authorized", // locally: authorized (pending capture confirmation via webhook)
        captureRecordedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(payments.id, match[0].paymentId));

    return NextResponse.json({
      verified: true,
      state: "pending_webhook" as PaymentConfirmationState,
      orderNumber: parsed.data.orderNumber,
      message: "Payment received. We are confirming with the payment provider. Please do not pay again. Your cart is preserved.",
    });
  }

  if (providerStatus === "authorized") {
    // Authorized but not captured. The customer's bank has reserved the
    // funds but Razorpay has not captured them yet. This is NOT final.
    await db
      .update(payments)
      .set({
        providerPaymentId: parsed.data.razorpayPaymentId,
        status: "authorized",
        updatedAt: new Date(),
      })
      .where(eq(payments.id, match[0].paymentId));

    return NextResponse.json({
      verified: true,
      state: "authorized_pending_capture" as PaymentConfirmationState,
      orderNumber: parsed.data.orderNumber,
      message: "Payment authorized. Capture is pending. Please do not pay again. We will notify you when capture is confirmed.",
    });
  }

  if (providerStatus === "failed") {
    await db
      .update(payments)
      .set({
        providerPaymentId: parsed.data.razorpayPaymentId,
        status: "failed",
        updatedAt: new Date(),
      })
      .where(eq(payments.id, match[0].paymentId));

    return NextResponse.json({
      verified: true,
      state: "failed" as PaymentConfirmationState,
      orderNumber: parsed.data.orderNumber,
      message: "Payment failed. Please try again or contact support.",
    });
  }

  // Any other provider status — pending reconciliation.
  return NextResponse.json({
    verified: true,
    state: "pending_reconciliation" as PaymentConfirmationState,
    orderNumber: parsed.data.orderNumber,
    message: "Payment is being processed. Please do not pay again. We will notify you when confirmation is complete.",
  });
}
