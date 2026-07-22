import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, isDatabaseConfigured } from "@/db/client";
import { addresses, customers, orderItems, orders, payments } from "@/db/schema";
import { verifyRazorpayWebhookSignature } from "@/lib/razorpay";
import { logger } from "@/lib/logger";
import { createInvoicePdf } from "@/lib/invoice";
import { sendPaidOrderNotifications } from "@/lib/notifications";
import { formatPrice } from "@/lib/products";

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
    const orderRecord = await db
      .select({ order: orders, customer: customers, address: addresses })
      .from(orders)
      .innerJoin(customers, eq(customers.id, orders.customerId))
      .innerJoin(addresses, eq(addresses.id, orders.shippingAddressId))
      .where(eq(orders.id, payment[0].orderId))
      .limit(1);
    if (
      orderRecord[0] &&
      (orderRecord[0].order.emailStatus !== "sent" ||
        orderRecord[0].order.whatsappStatus !== "sent")
    ) {
      const record = orderRecord[0];
      const lines = await db
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, record.order.id));
      const invoiceNumber = record.order.invoiceNumber ?? `INV-${record.order.orderNumber}`;
      try {
        const invoicePdf = await createInvoicePdf({
          invoiceNumber,
          orderNumber: record.order.orderNumber,
          issuedAt: new Date(),
          customer: {
            name: record.customer.name,
            businessName: record.customer.businessName,
            gstin: record.customer.gstin,
            address: record.address.line1,
            city: record.address.city,
            state: record.address.state,
            pincode: record.address.pincode,
          },
          items: lines,
          totalInclGstPaise: record.order.totalInclGstPaise,
          includedGstPaise: record.order.includedGstPaise,
        });
        await db
          .update(orders)
          .set({ invoiceNumber, invoiceGeneratedAt: new Date() })
          .where(eq(orders.id, record.order.id));
        const retryEmail = record.order.emailStatus !== "sent";
        const retryWhatsapp = record.order.whatsappStatus !== "sent";
        const notification = await sendPaidOrderNotifications(
          {
            orderNumber: record.order.orderNumber,
            invoiceNumber,
            customerName: record.customer.name,
            customerEmail: record.customer.email,
            customerMobile: record.customer.mobile,
            total: formatPrice(record.order.totalInclGstPaise),
            invoicePdf,
          },
          {},
          { email: retryEmail, whatsapp: retryWhatsapp },
        );
        const statuses = {
          emailStatus: retryEmail ? notification.emailStatus : record.order.emailStatus,
          whatsappStatus: retryWhatsapp ? notification.whatsappStatus : record.order.whatsappStatus,
        };
        await db
          .update(orders)
          .set({ ...statuses, notificationUpdatedAt: new Date() })
          .where(eq(orders.id, record.order.id));
        if (statuses.emailStatus === "failed")
          logger.error(
            { event: "order_email_failed", orderNumber: record.order.orderNumber },
            "Paid-order email failed",
          );
        if (statuses.whatsappStatus === "failed")
          logger.error(
            { event: "order_whatsapp_failed", orderNumber: record.order.orderNumber },
            "Paid-order WhatsApp failed",
          );
      } catch (error) {
        logger.error(
          {
            event: "invoice_generation_failed",
            orderNumber: record.order.orderNumber,
            error: error instanceof Error ? error.message : "unknown",
          },
          "Paid-order fulfilment notification failed",
        );
        await db
          .update(orders)
          .set({
            emailStatus: record.order.emailStatus === "sent" ? "sent" : "failed",
            whatsappStatus: record.order.whatsappStatus === "sent" ? "sent" : "failed",
            notificationUpdatedAt: new Date(),
          })
          .where(eq(orders.id, record.order.id));
      }
    }
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
  }
  return NextResponse.json({ received: true, matched: true });
}
