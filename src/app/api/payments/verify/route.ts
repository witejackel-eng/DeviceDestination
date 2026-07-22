import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, isDatabaseConfigured } from "@/db/client";
import { orders, payments } from "@/db/schema";
import { createOrderConfirmationToken } from "@/lib/order-token";
import { verifyRazorpayPaymentSignature } from "@/lib/razorpay";

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
  if (!verified)
    return NextResponse.json({ error: "Payment verification failed." }, { status: 400 });
  if (!isDatabaseConfigured())
    return NextResponse.json({ error: "Order storage is unavailable." }, { status: 503 });

  const db = getDb();
  const match = await db
    .select({ paymentId: payments.id, orderId: orders.id })
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
