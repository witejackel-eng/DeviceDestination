import { and, eq } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/db/client";
import {
  addresses,
  customers,
  enquiries,
  inventoryReservations,
  orderItems,
  orders,
  payments,
} from "@/db/schema";
import { createInvoicePdf } from "@/lib/invoice";
import {
  sendEnquiryNotifications,
  sendPaidOrderNotifications,
} from "@/lib/notifications";
import { formatPrice } from "@/lib/products";
import { expirePendingReservations, releaseReservationsForOrder } from "@/lib/inventory";
import { reconcileOrderPayment } from "@/lib/reconciliation";
import { isEmailConfigured, isWhatsAppConfigured } from "@/lib/env";
import { logger } from "@/lib/logger";
import type { JobPayload } from "@/lib/jobs";
import { JobError } from "@/lib/jobs";

/**
 * Central dispatcher. Each job type maps to a handler. Handlers MUST:
 *  - Be idempotent (safe to retry)
 *  - Throw `JobError` for retryable failures
 *  - Return silently on success
 *  - Tolerate missing configuration (e.g. email not configured) by recording
 *    a safe skipped state and returning normally
 */
export async function dispatchJob(job: {
  id: string;
  type: string;
  payload: JobPayload;
}): Promise<void> {
  switch (job.type) {
    case "send-order-email":
      return handleSendOrderEmail(job.payload);
    case "send-order-whatsapp":
      return handleSendOrderWhatsapp(job.payload);
    case "send-enquiry-email":
      return handleSendEnquiryEmail(job.payload);
    case "send-enquiry-whatsapp":
      return handleSendEnquiryWhatsapp(job.payload);
    case "generate-invoice":
      return handleGenerateInvoice(job.payload);
    case "expire-inventory-reservation":
      return handleExpireReservations();
    case "reconcile-payment":
      return handleReconcilePayment(job.payload);
    case "send-shipment-update":
      return handleSendShipmentUpdate(job.payload);
    case "retry-failed-notification":
      return handleRetryFailedNotification(job.payload);
    default:
      throw new JobError(`Unknown job type: ${job.type}`, "unknown_job_type", false);
  }
}

async function loadOrderForNotification(orderId: string) {
  if (!isDatabaseConfigured()) return null;
  const db = getDb();
  const [row] = await db
    .select({
      order: orders,
      customer: customers,
      address: addresses,
    })
    .from(orders)
    .innerJoin(customers, eq(customers.id, orders.customerId))
    .innerJoin(addresses, eq(addresses.id, orders.shippingAddressId))
    .where(eq(orders.id, orderId))
    .limit(1);
  if (!row) return null;
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  return { ...row, items };
}

async function handleSendOrderEmail(payload: JobPayload): Promise<void> {
  if (!isEmailConfigured()) {
    logger.info({ event: "send_order_email_skipped", reason: "email_unconfigured" }, "Email channel not configured");
    return;
  }
  const orderId = String(payload.orderId ?? "");
  if (!orderId) throw new JobError("Missing orderId", "missing_order_id", false);
  const record = await loadOrderForNotification(orderId);
  if (!record) throw new JobError("Order not found", "order_not_found", false);
  if (record.order.emailStatus === "sent") return;
  if (!record.order.invoiceNumber) {
    // Defer until invoice exists.
    throw new JobError("Invoice not yet generated; deferring", "no_invoice", true);
  }
  const invoicePdf = await createInvoicePdf({
    invoiceNumber: record.order.invoiceNumber,
    orderNumber: record.order.orderNumber,
    issuedAt: record.order.invoiceGeneratedAt ?? new Date(),
    customer: {
      name: record.customer.name,
      businessName: record.customer.businessName,
      gstin: record.customer.gstin,
      address: record.address.line1,
      city: record.address.city,
      state: record.address.state,
      pincode: record.address.pincode,
    },
    items: record.items,
    totalInclGstPaise: record.order.totalInclGstPaise,
    includedGstPaise: record.order.includedGstPaise,
  });
  const result = await sendPaidOrderNotifications(
    {
      orderNumber: record.order.orderNumber,
      invoiceNumber: record.order.invoiceNumber,
      customerName: record.customer.name,
      customerEmail: record.customer.email,
      customerMobile: record.customer.mobile,
      total: formatPrice(record.order.totalInclGstPaise),
      invoicePdf,
    },
    {},
    { email: true, whatsapp: false },
  );
  await getDb()
    .update(orders)
    .set({
      emailStatus: result.emailStatus,
      notificationUpdatedAt: new Date(),
    })
    .where(eq(orders.id, orderId));
  if (result.emailStatus !== "sent") {
    throw new JobError(`Email send failed: ${result.emailStatus}`, "email_failed", true);
  }
}

async function handleSendOrderWhatsapp(payload: JobPayload): Promise<void> {
  if (!isWhatsAppConfigured()) {
    logger.info({ event: "send_order_whatsapp_skipped", reason: "whatsapp_unconfigured" }, "WhatsApp channel not configured");
    return;
  }
  const orderId = String(payload.orderId ?? "");
  if (!orderId) throw new JobError("Missing orderId", "missing_order_id", false);
  const record = await loadOrderForNotification(orderId);
  if (!record) throw new JobError("Order not found", "order_not_found", false);
  if (record.order.whatsappStatus === "sent") return;
  if (!record.order.invoiceNumber) {
    throw new JobError("Invoice not yet generated; deferring", "no_invoice", true);
  }
  const invoicePdf = await createInvoicePdf({
    invoiceNumber: record.order.invoiceNumber,
    orderNumber: record.order.orderNumber,
    issuedAt: record.order.invoiceGeneratedAt ?? new Date(),
    customer: {
      name: record.customer.name,
      businessName: record.customer.businessName,
      gstin: record.customer.gstin,
      address: record.address.line1,
      city: record.address.city,
      state: record.address.state,
      pincode: record.address.pincode,
    },
    items: record.items,
    totalInclGstPaise: record.order.totalInclGstPaise,
    includedGstPaise: record.order.includedGstPaise,
  });
  const result = await sendPaidOrderNotifications(
    {
      orderNumber: record.order.orderNumber,
      invoiceNumber: record.order.invoiceNumber,
      customerName: record.customer.name,
      customerEmail: record.customer.email,
      customerMobile: record.customer.mobile,
      total: formatPrice(record.order.totalInclGstPaise),
      invoicePdf,
    },
    {},
    { email: false, whatsapp: true },
  );
  await getDb()
    .update(orders)
    .set({
      whatsappStatus: result.whatsappStatus,
      notificationUpdatedAt: new Date(),
    })
    .where(eq(orders.id, orderId));
  if (result.whatsappStatus !== "sent") {
    throw new JobError(`WhatsApp send failed: ${result.whatsappStatus}`, "whatsapp_failed", true);
  }
}

async function handleSendEnquiryEmail(payload: JobPayload): Promise<void> {
  if (!isEmailConfigured()) return;
  const enquiryId = String(payload.enquiryId ?? "");
  if (!enquiryId) throw new JobError("Missing enquiryId", "missing_enquiry_id", false);
  if (!isDatabaseConfigured()) return;
  const db = getDb();
  const [enquiry] = await db.select().from(enquiries).where(eq(enquiries.id, enquiryId)).limit(1);
  if (!enquiry) throw new JobError("Enquiry not found", "enquiry_not_found", false);
  await sendEnquiryNotifications({
    reference: enquiry.referenceNumber,
    type: enquiry.type,
    name: enquiry.name,
    email: enquiry.email,
    mobile: enquiry.mobile,
    message: enquiry.message,
  });
}

async function handleSendEnquiryWhatsapp(payload: JobPayload): Promise<void> {
  // WhatsApp enquiry notifications use the same provider path as enquiry email.
  // Kept as a separate job type so failures on one channel do not block the other.
  await handleSendEnquiryEmail(payload);
}

async function handleGenerateInvoice(payload: JobPayload): Promise<void> {
  const orderId = String(payload.orderId ?? "");
  if (!orderId) throw new JobError("Missing orderId", "missing_order_id", false);
  if (!isDatabaseConfigured()) return;
  const db = getDb();
  const [record] = await db
    .select({ order: orders, customer: customers, address: addresses })
    .from(orders)
    .innerJoin(customers, eq(customers.id, orders.customerId))
    .innerJoin(addresses, eq(addresses.id, orders.shippingAddressId))
    .where(eq(orders.id, orderId))
    .limit(1);
  if (!record) throw new JobError("Order not found", "order_not_found", false);
  if (record.order.invoiceNumber && record.order.invoiceGeneratedAt) return;
  const invoiceNumber = record.order.invoiceNumber ?? `INV-${record.order.orderNumber}`;
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  await createInvoicePdf({
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
    items,
    totalInclGstPaise: record.order.totalInclGstPaise,
    includedGstPaise: record.order.includedGstPaise,
  });
  await db
    .update(orders)
    .set({ invoiceNumber, invoiceGeneratedAt: new Date() })
    .where(eq(orders.id, orderId));
}

async function handleExpireReservations(): Promise<void> {
  if (!isDatabaseConfigured()) return;
  const result = await expirePendingReservations();
  if (result.ordersAffected.length > 0) {
    const db = getDb();
    for (const orderId of result.ordersAffected) {
      // Mark unpaid orders as cancelled (preserving the record).
      await db
        .update(orders)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(
          and(
            eq(orders.id, orderId),
            eq(orders.status, "payment_pending"),
          ),
        );
    }
  }
}

async function handleReconcilePayment(payload: JobPayload): Promise<void> {
  const orderId = String(payload.orderId ?? "");
  if (!orderId) return;
  await reconcileOrderPayment(orderId, undefined);
}

async function handleSendShipmentUpdate(payload: JobPayload): Promise<void> {
  const orderId = String(payload.orderId ?? "");
  if (!orderId) throw new JobError("Missing orderId", "missing_order_id", false);
  // Reuse the order-email channel — shipment updates contain the order context.
  await handleSendOrderEmail({ orderId });
}

async function handleRetryFailedNotification(payload: JobPayload): Promise<void> {
  const orderId = String(payload.orderId ?? "");
  const channel = String(payload.channel ?? "email");
  if (!orderId) return;
  if (channel === "email") {
    await handleSendOrderEmail({ orderId });
  } else if (channel === "whatsapp") {
    await handleSendOrderWhatsapp({ orderId });
  }
}
