import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, isDatabaseConfigured } from "@/db/client";
import { orders, payments } from "@/db/schema";
import { verifyRazorpayWebhookSignature } from "@/lib/razorpay";
import { logger } from "@/lib/logger";
import { consumeReservationsForOrder, releaseReservationsForOrder } from "@/lib/inventory";
import { enqueueJob } from "@/lib/jobs";

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

export async function POST(request: Request) {
  const payload = await request.text();
  const signature = request.headers.get("x-razorpay-signature") ?? "";
  if (!verifyRazorpayWebhookSignature(payload, signature)) {
    logger.warn({ event: "invalid_webhook_signature" }, "Invalid Razorpay webhook signature");
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  }
  let body: unknown;
  try {
    body = JSON.parse(payload);
  } catch {
    return NextResponse.json({ error: "Malformed webhook payload." }, { status: 400 });
  }
  const parsed = webhookSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "Unsupported webhook payload." }, { status: 400 });
  if (!isDatabaseConfigured())
    return NextResponse.json({ error: "Order storage is unavailable." }, { status: 503 });

  const db = getDb();
  const payment = await db
    .select()
    .from(payments)
    .where(eq(payments.providerOrderId, parsed.data.payload.payment.entity.order_id))
    .limit(1);
  if (!payment[0]) return NextResponse.json({ received: true, matched: false });
  if (parsed.data.payload.payment.entity.amount !== payment[0].amountPaise) {
    logger.error(
      { event: "payment_amount_mismatch", providerOrderId: payment[0].providerOrderId },
      "Webhook amount did not match stored order",
    );
    return NextResponse.json({ error: "Payment amount mismatch." }, { status: 409 });
  }
  const eventId =
    request.headers.get("x-razorpay-event-id") ??
    `${parsed.data.event}:${parsed.data.payload.payment.entity.id}`;
  if (payment[0].rawEventId === eventId)
    return NextResponse.json({ received: true, duplicate: true });
  if (payment[0].status === "captured" && parsed.data.event === "payment.failed")
    return NextResponse.json({ received: true, ignored: true, reason: "already_captured" });

  if (parsed.data.event === "payment.captured") {
    await db
      .update(payments)
      .set({
        status: "captured",
        providerPaymentId: parsed.data.payload.payment.entity.id,
        rawEventId: eventId,
        updatedAt: new Date(),
      })
      .where(eq(payments.id, payment[0].id));
    await db
      .update(orders)
      .set({ status: "paid", updatedAt: new Date() })
      .where(eq(orders.id, payment[0].orderId));
    logger.info(
      { event: "order_payment_captured", providerOrderId: payment[0].providerOrderId },
      "Order marked paid after captured webhook",
    );

    // Consume the inventory reservations for this order (decrement available
    // and reserved atomically). Idempotent.
    await consumeReservationsForOrder(payment[0].orderId);

    // Enqueue invoice generation and notifications as durable jobs so that
    // failures can be retried independently without rolling back paid status.
    await enqueueJob({
      type: "generate-invoice",
      payload: { orderId: payment[0].orderId },
    });
    await enqueueJob({
      type: "send-order-email",
      payload: { orderId: payment[0].orderId },
    });
    await enqueueJob({
      type: "send-order-whatsapp",
      payload: { orderId: payment[0].orderId },
    });
  } else if (parsed.data.event === "payment.failed") {
    await db
      .update(payments)
      .set({
        status: "failed",
        providerPaymentId: parsed.data.payload.payment.entity.id,
        rawEventId: eventId,
        updatedAt: new Date(),
      })
      .where(eq(payments.id, payment[0].id));
    // Release the inventory reservations — the order remains as a record but
    // stock is no longer held.
    await releaseReservationsForOrder(payment[0].orderId, "payment_failed");
  }
  return NextResponse.json({ received: true, matched: true });
}
