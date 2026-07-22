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

const schema = z.object({
  orderNumber: z.string().startsWith("DD-").max(40),
  razorpayOrderId: z.string().min(1).max(120),
  razorpayPaymentId: z.string().min(1).max(120),
  signature: z.string().min(20).max(256),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid payment response." }, { status: 400 });
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
  if (!isDatabaseConfigured())
    return NextResponse.json({ error: "Order storage is unavailable." }, { status: 503 });

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
  if (!match[0]) return NextResponse.json({ error: "Order record not found." }, { status: 404 });
  if (match[0].paymentStatus === "captured")
    return NextResponse.json({
      verified: true,
      captured: true,
      orderNumber: parsed.data.orderNumber,
      confirmationToken: createOrderConfirmationToken(parsed.data.orderNumber),
    });
  const providerPayment = await getRazorpay().payments.fetch(parsed.data.razorpayPaymentId);
  const providerValid = validateRazorpayPaymentRecord({
    expectedOrderId: parsed.data.razorpayOrderId,
    expectedAmountPaise: match[0].amountPaise,
    providerOrderId: providerPayment.order_id,
    providerAmountPaise: Number(providerPayment.amount),
    providerStatus: providerPayment.status,
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
      { error: "Payment details do not match this order. Do not pay again; contact support." },
      { status: 409 },
    );
  }
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
    orderNumber: parsed.data.orderNumber,
    confirmationToken: createOrderConfirmationToken(parsed.data.orderNumber),
  });
}
