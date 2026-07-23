"use server";

import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb, isDatabaseConfigured } from "@/db/client";
import {
  addresses,
  customers,
  inventoryReservations,
  orderItems,
  orders,
  orderStatusEvents,
  payments,
  refunds,
} from "@/db/schema";
import { resolveAdmin } from "@/lib/admin-auth";
import { recordAudit } from "@/lib/audit";
import {
  assertTransition,
  canCancelUnpaid,
  canDeliver,
  canRequestRefund,
  canShip,
  isAllowedTransition,
  InvalidOrderTransitionError,
  type OrderStatus,
} from "@/lib/order-state";
import { enqueueJob } from "@/lib/jobs";
import { releaseReservationsForOrder } from "@/lib/inventory";
import { createRefund, recomputeOrderRefundTotal } from "@/lib/refunds";
import { logger } from "@/lib/logger";

export type ActionResult = { ok: true } | { ok: false; reason: string; status?: number };

const transitionSchema = z.object({
  orderId: z.string().uuid(),
  toStatus: z.enum([
    "pending",
    "payment_pending",
    "paid",
    "processing",
    "shipped",
    "delivered",
    "cancelled",
    "refund_pending",
    "refunded",
  ]),
  note: z.string().trim().max(500).optional(),
});

const fulfilmentSchema = z.object({
  orderId: z.string().uuid(),
  courierName: z.string().trim().min(1).max(120),
  trackingNumber: z.string().trim().min(1).max(120),
  trackingUrl: z.string().url().max(500).nullable().optional(),
  estimatedDeliveryAt: z.string().datetime().nullable().optional(),
  note: z.string().trim().max(500).optional(),
});

const internalNoteSchema = z.object({
  orderId: z.string().uuid(),
  note: z.string().trim().min(1).max(2000),
});

const refundRequestSchema = z.object({
  orderId: z.string().uuid(),
  amountPaise: z.number().int().min(1).max(9900000000),
  reason: z.string().trim().min(3).max(500),
});

export async function listOrdersForAdmin(input: {
  status?: OrderStatus | "all";
  notificationFailure?: boolean;
  reservationExpired?: boolean;
  page?: number;
  pageSize?: number;
}) {
  const admin = await resolveAdmin();
  if (!admin.ok) return { items: [], total: 0 };
  if (!isDatabaseConfigured()) return { items: [], total: 0 };
  const db = getDb();
  const page = Math.max(1, input.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, input.pageSize ?? 25));
  const conditions = [];
  if (input.status && input.status !== "all") {
    conditions.push(eq(orders.status, input.status));
  }
  if (input.notificationFailure) {
    conditions.push(sql`(${orders.emailStatus} = 'failed' OR ${orders.whatsappStatus} = 'failed')`);
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const rows = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      status: orders.status,
      totalInclGstPaise: orders.totalInclGstPaise,
      emailStatus: orders.emailStatus,
      whatsappStatus: orders.whatsappStatus,
      createdAt: orders.createdAt,
      customerName: customers.name,
      customerMobile: customers.mobile,
    })
    .from(orders)
    .innerJoin(customers, eq(customers.id, orders.customerId))
    .where(where)
    .orderBy(desc(orders.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  const totalRows = await db.select({ count: sql<number>`count(*)` }).from(orders).where(where);
  return { items: rows, total: Number(totalRows[0]?.count ?? 0), page, pageSize };
}

export async function getOrderDetailForAdmin(orderId: string) {
  const admin = await resolveAdmin();
  if (!admin.ok) return null;
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
  const paymentRows = await db.select().from(payments).where(eq(payments.orderId, orderId));
  const refundRows = await db.select().from(refunds).where(eq(refunds.orderId, orderId));
  const reservations = await db
    .select()
    .from(inventoryReservations)
    .where(eq(inventoryReservations.orderId, orderId));
  const events = await db
    .select()
    .from(orderStatusEvents)
    .where(eq(orderStatusEvents.orderId, orderId))
    .orderBy(desc(orderStatusEvents.createdAt));
  return { ...row, items, payments: paymentRows, refunds: refundRows, reservations, events };
}

export async function transitionOrderStatusAction(input: z.infer<typeof transitionSchema>): Promise<ActionResult> {
  const admin = await resolveAdmin();
  if (!admin.ok) return { ok: false, reason: admin.reason, status: admin.status };
  const parsed = transitionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: parsed.error.issues[0]?.message ?? "Invalid input" };
  if (!isDatabaseConfigured()) return { ok: false, reason: "Database is not configured", status: 503 };
  const db = getDb();
  const [existing] = await db.select().from(orders).where(eq(orders.id, parsed.data.orderId)).limit(1);
  if (!existing) return { ok: false, reason: "Order not found" };
  const from = existing.status;
  const to = parsed.data.toStatus;
  try {
    assertTransition(from, to);
  } catch (error) {
    if (error instanceof InvalidOrderTransitionError) {
      return { ok: false, reason: `Transition ${from} → ${to} is not allowed` };
    }
    throw error;
  }
  // Shipment requires paid-equivalent state — but the state machine already
  // enforces this via canShip + ALLOWED map.
  if (to === "shipped" && !canShip(from)) {
    return { ok: false, reason: "Order must be in processing before shipment" };
  }
  // Cancellation of unpaid orders releases inventory.
  if (to === "cancelled" && canCancelUnpaid(from)) {
    await releaseReservationsForOrder(parsed.data.orderId, "order_cancelled");
  }
  await db
    .update(orders)
    .set({ status: to, updatedAt: new Date() })
    .where(eq(orders.id, parsed.data.orderId));
  await db.insert(orderStatusEvents).values({
    orderId: parsed.data.orderId,
    fromStatus: from,
    toStatus: to,
    actorUserId: admin.context.userId,
    actorEmail: admin.context.email,
    note: parsed.data.note ?? null,
  });
  await recordAudit({
    actorUserId: admin.context.userId,
    actorEmail: admin.context.email,
    action: "order_status_transition",
    entityType: "order",
    entityId: parsed.data.orderId,
    before: { status: from },
    after: { status: to, note: parsed.data.note },
  });
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${parsed.data.orderId}`);
  return { ok: true };
}

export async function recordShipmentAction(input: z.infer<typeof fulfilmentSchema>): Promise<ActionResult> {
  const admin = await resolveAdmin();
  if (!admin.ok) return { ok: false, reason: admin.reason, status: admin.status };
  const parsed = fulfilmentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: parsed.error.issues[0]?.message ?? "Invalid input" };
  if (!isDatabaseConfigured()) return { ok: false, reason: "Database is not configured", status: 503 };
  const db = getDb();
  const [existing] = await db.select().from(orders).where(eq(orders.id, parsed.data.orderId)).limit(1);
  if (!existing) return { ok: false, reason: "Order not found" };
  if (!canShip(existing.status)) {
    return { ok: false, reason: "Order must be in processing before shipment can be recorded" };
  }
  await db
    .update(orders)
    .set({
      status: "shipped",
      courierName: parsed.data.courierName,
      trackingNumber: parsed.data.trackingNumber,
      trackingUrl: parsed.data.trackingUrl ?? null,
      estimatedDeliveryAt: parsed.data.estimatedDeliveryAt ? new Date(parsed.data.estimatedDeliveryAt) : null,
      dispatchedAt: new Date(),
      fulfilmentNotes: parsed.data.note ?? existing.fulfilmentNotes,
      updatedAt: new Date(),
    })
    .where(eq(orders.id, parsed.data.orderId));
  await db.insert(orderStatusEvents).values({
    orderId: parsed.data.orderId,
    fromStatus: existing.status,
    toStatus: "shipped",
    actorUserId: admin.context.userId,
    actorEmail: admin.context.email,
    note: `Courier: ${parsed.data.courierName}, Tracking: ${parsed.data.trackingNumber}`,
  });
  await enqueueJob({
    type: "send-shipment-update",
    payload: { orderId: parsed.data.orderId },
  });
  await recordAudit({
    actorUserId: admin.context.userId,
    actorEmail: admin.context.email,
    action: "order_shipment_recorded",
    entityType: "order",
    entityId: parsed.data.orderId,
    after: {
      courier: parsed.data.courierName,
      tracking: parsed.data.trackingNumber,
      trackingUrl: parsed.data.trackingUrl,
    },
  });
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${parsed.data.orderId}`);
  return { ok: true };
}

export async function markDeliveredAction(input: { orderId: string; note?: string }): Promise<ActionResult> {
  const admin = await resolveAdmin();
  if (!admin.ok) return { ok: false, reason: admin.reason, status: admin.status };
  if (!isDatabaseConfigured()) return { ok: false, reason: "Database is not configured", status: 503 };
  const db = getDb();
  const [existing] = await db.select().from(orders).where(eq(orders.id, input.orderId)).limit(1);
  if (!existing) return { ok: false, reason: "Order not found" };
  if (!canDeliver(existing.status)) {
    return { ok: false, reason: "Order must be shipped before delivery can be recorded" };
  }
  await db
    .update(orders)
    .set({ status: "delivered", deliveredAt: new Date(), updatedAt: new Date() })
    .where(eq(orders.id, input.orderId));
  await db.insert(orderStatusEvents).values({
    orderId: input.orderId,
    fromStatus: existing.status,
    toStatus: "delivered",
    actorUserId: admin.context.userId,
    actorEmail: admin.context.email,
    note: input.note ?? null,
  });
  await recordAudit({
    actorUserId: admin.context.userId,
    actorEmail: admin.context.email,
    action: "order_delivered",
    entityType: "order",
    entityId: input.orderId,
  });
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${input.orderId}`);
  return { ok: true };
}

export async function addInternalNoteAction(input: z.infer<typeof internalNoteSchema>): Promise<ActionResult> {
  const admin = await resolveAdmin();
  if (!admin.ok) return { ok: false, reason: admin.reason, status: admin.status };
  const parsed = internalNoteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: parsed.error.issues[0]?.message ?? "Invalid input" };
  if (!isDatabaseConfigured()) return { ok: false, reason: "Database is not configured", status: 503 };
  const db = getDb();
  const [existing] = await db.select().from(orders).where(eq(orders.id, parsed.data.orderId)).limit(1);
  if (!existing) return { ok: false, reason: "Order not found" };
  const combined = existing.internalNotes
    ? `${existing.internalNotes}\n---\n${new Date().toISOString()} (${admin.context.email}): ${parsed.data.note}`
    : `${new Date().toISOString()} (${admin.context.email}): ${parsed.data.note}`;
  await db
    .update(orders)
    .set({ internalNotes: combined, updatedAt: new Date() })
    .where(eq(orders.id, parsed.data.orderId));
  await recordAudit({
    actorUserId: admin.context.userId,
    actorEmail: admin.context.email,
    action: "order_internal_note_added",
    entityType: "order",
    entityId: parsed.data.orderId,
  });
  revalidatePath(`/admin/orders/${parsed.data.orderId}`);
  return { ok: true };
}

export async function retryNotificationAction(input: {
  orderId: string;
  channel: "email" | "whatsapp" | "invoice";
}): Promise<ActionResult> {
  const admin = await resolveAdmin();
  if (!admin.ok) return { ok: false, reason: admin.reason, status: admin.status };
  if (!isDatabaseConfigured()) return { ok: false, reason: "Database is not configured", status: 503 };
  const db = getDb();
  const [existing] = await db.select().from(orders).where(eq(orders.id, input.orderId)).limit(1);
  if (!existing) return { ok: false, reason: "Order not found" };
  if (input.channel === "email") {
    await db
      .update(orders)
      .set({ emailStatus: "pending", updatedAt: new Date() })
      .where(eq(orders.id, input.orderId));
    await enqueueJob({ type: "send-order-email", payload: { orderId: input.orderId } });
  } else if (input.channel === "whatsapp") {
    await db
      .update(orders)
      .set({ whatsappStatus: "pending", updatedAt: new Date() })
      .where(eq(orders.id, input.orderId));
    await enqueueJob({ type: "send-order-whatsapp", payload: { orderId: input.orderId } });
  } else {
    await enqueueJob({ type: "generate-invoice", payload: { orderId: input.orderId } });
  }
  await recordAudit({
    actorUserId: admin.context.userId,
    actorEmail: admin.context.email,
    action: "notification_retry",
    entityType: "order",
    entityId: input.orderId,
    after: { channel: input.channel },
  });
  revalidatePath(`/admin/orders/${input.orderId}`);
  return { ok: true };
}

export async function requestRefundAction(input: z.infer<typeof refundRequestSchema>): Promise<ActionResult> {
  const admin = await resolveAdmin();
  if (!admin.ok) return { ok: false, reason: admin.reason, status: admin.status };
  const parsed = refundRequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, reason: parsed.error.issues[0]?.message ?? "Invalid input" };
  if (!isDatabaseConfigured()) return { ok: false, reason: "Database is not configured", status: 503 };
  const db = getDb();
  const [existing] = await db.select().from(orders).where(eq(orders.id, parsed.data.orderId)).limit(1);
  if (!existing) return { ok: false, reason: "Order not found" };
  if (!canRequestRefund(existing.status)) {
    return { ok: false, reason: `Refunds cannot be requested from status ${existing.status}` };
  }
  try {
    const result = await createRefund({
      orderId: parsed.data.orderId,
      amountPaise: parsed.data.amountPaise,
      reason: parsed.data.reason,
      actorUserId: admin.context.userId,
      actorEmail: admin.context.email,
    });
    await recomputeOrderRefundTotal(parsed.data.orderId);
    // Transition to refund_pending if a partial refund is in flight; leave as-is
    // if the refund is fully processed (admin must explicitly mark refunded).
    if (result.status === "pending" || result.status === "processing") {
      if (isAllowedTransition(existing.status, "refund_pending")) {
        await db
          .update(orders)
          .set({ status: "refund_pending", updatedAt: new Date() })
          .where(eq(orders.id, parsed.data.orderId));
        await db.insert(orderStatusEvents).values({
          orderId: parsed.data.orderId,
          fromStatus: existing.status,
          toStatus: "refund_pending",
          actorUserId: admin.context.userId,
          actorEmail: admin.context.email,
          note: `Refund ${parsed.data.amountPaise} paise: ${parsed.data.reason}`,
        });
      }
    }
    await recordAudit({
      actorUserId: admin.context.userId,
      actorEmail: admin.context.email,
      action: "refund_requested",
      entityType: "order",
      entityId: parsed.data.orderId,
      after: { refundId: result.refundId, status: result.status, amountPaise: parsed.data.amountPaise },
    });
    revalidatePath("/admin/orders");
    revalidatePath(`/admin/orders/${parsed.data.orderId}`);
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    logger.error({ event: "refund_request_failed", orderId: parsed.data.orderId, error: message }, "Refund request failed");
    return { ok: false, reason: message };
  }
}
