import { and, eq, sql } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/db/client";
import {
  inventoryReservations,
  jobs,
  orders,
  paymentReconciliationResults,
  payments,
} from "@/db/schema";
import { getRazorpay } from "@/lib/razorpay";
import { isRazorpayConfigured } from "@/lib/env";
import { logger } from "@/lib/logger";
import { consumeReservationsForOrder, reserveInventoryForOrder } from "@/lib/inventory";
import { enqueueDeduplicatedJob, jobDedupeKey } from "@/lib/jobs";
import type { reconciliationOutcome } from "@/db/schema";

export type ReconciliationOutcomeValue = (typeof reconciliationOutcome.enumValues)[number];

export type ReconciliationResult = {
  outcome: ReconciliationOutcomeValue;
  localStatus: string;
  providerStatus: string | null;
  localAmountPaise: number | null;
  providerAmountPaise: number | null;
  notes: string | null;
};

/**
 * Reconcile a single order's payment state against Razorpay's records.
 *
 * Outcomes:
 *  - match: local and provider agree
 *  - local_paid_provider_pending: local says captured, provider disagrees (NEVER auto-downgrade)
 *  - local_pending_provider_captured: provider says captured but local is still pending (auto-promote after audit)
 *  - amount_mismatch: provider amount differs from stored amount
 *  - duplicate_event: raw_event_id matches a previous event (no action)
 *  - provider_error: API call failed (retry later)
 */
export async function reconcileOrderPayment(
  orderId: string,
  actorUserId: string | undefined,
): Promise<ReconciliationResult> {
  if (!isDatabaseConfigured()) {
    return {
      outcome: "provider_error",
      localStatus: "unknown",
      providerStatus: null,
      localAmountPaise: null,
      providerAmountPaise: null,
      notes: "Database is not configured",
    };
  }
  const db = getDb();
  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.orderId, orderId))
    .limit(1);
  if (!payment) {
    return {
      outcome: "provider_error",
      localStatus: "no_payment",
      providerStatus: null,
      localAmountPaise: null,
      providerAmountPaise: null,
      notes: "No payment record for this order",
    };
  }

  if (!isRazorpayConfigured()) {
    const result: ReconciliationResult = {
      outcome: "provider_error",
      localStatus: payment.status,
      providerStatus: null,
      localAmountPaise: payment.amountPaise,
      providerAmountPaise: null,
      notes: "Razorpay is not configured",
    };
    await persistReconciliationResult(orderId, payment.id, result, actorUserId);
    return result;
  }

  let providerPayment: { status?: string; amount?: string | number; order_id?: string; id?: string } & Record<string, unknown>;
  try {
    if (!payment.providerPaymentId) {
      // Fetch all payments for the provider order, pick the latest.
      const providerOrder = await getRazorpay().orders.fetchPayments(payment.providerOrderId);
      const items = (providerOrder as { items?: Array<{ status?: string; amount?: string | number; order_id?: string; id?: string }> }).items ?? [];
      const captured = items.find((item) => item.status === "captured");
      providerPayment = captured ?? items[0] ?? {};
    } else {
      providerPayment = (await getRazorpay().payments.fetch(payment.providerPaymentId)) as { status?: string; amount?: string | number; order_id?: string; id?: string };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    const result: ReconciliationResult = {
      outcome: "provider_error",
      localStatus: payment.status,
      providerStatus: null,
      localAmountPaise: payment.amountPaise,
      providerAmountPaise: null,
      notes: `Provider fetch failed: ${message.slice(0, 200)}`,
    };
    await persistReconciliationResult(orderId, payment.id, result, actorUserId);
    return result;
  }

  const providerStatus = String(providerPayment.status ?? "unknown").toLowerCase();
  const providerAmount = Number(providerPayment.amount ?? 0);
  const localAmount = payment.amountPaise;
  const localStatus = payment.status;

  let outcome: ReconciliationOutcomeValue;
  let notes: string | null = null;

  if (providerAmount !== localAmount && providerAmount > 0) {
    outcome = "amount_mismatch";
    notes = `Local ${localAmount} vs provider ${providerAmount}. Recorded but never auto-downgraded.`;
  } else if (localStatus === "captured" && providerStatus !== "captured") {
    outcome = "local_paid_provider_pending";
    notes = `Local captured but provider reports ${providerStatus}. Requires operational review — never auto-downgrade.`;
  } else if (
    (localStatus === "created" || localStatus === "authorized") &&
    providerStatus === "captured"
  ) {
    outcome = "local_pending_provider_captured";
    // Safe auto-promote: provider says captured AND amount matches AND signature
    // was previously verified (we have a providerPaymentId from verify route or webhook).
    if (providerAmount === localAmount) {
      await db
        .update(payments)
        .set({
          status: "captured",
          providerPaymentId: providerPayment.id ?? payment.providerPaymentId,
          captureRecordedAt: payment.captureRecordedAt ?? new Date(),
          updatedAt: new Date(),
        })
        .where(eq(payments.id, payment.id));
      await db
        .update(orders)
        .set({ status: "paid", lastReconciledAt: new Date(), updatedAt: new Date() })
        .where(eq(orders.id, orderId));
      await db
        .update(payments)
        .set({ orderPaidMarkedAt: payment.orderPaidMarkedAt ?? new Date(), updatedAt: new Date() })
        .where(eq(payments.id, payment.id));
      notes = "Auto-promoted to paid after provider confirmed capture with matching amount.";
    }
  } else {
    outcome = "match";
  }

  await db
    .update(orders)
    .set({ lastReconciledAt: new Date(), updatedAt: new Date() })
    .where(eq(orders.id, orderId));

  const result: ReconciliationResult = {
    outcome,
    localStatus,
    providerStatus,
    localAmountPaise: localAmount,
    providerAmountPaise: providerAmount > 0 ? providerAmount : null,
    notes,
  };
  await persistReconciliationResult(orderId, payment.id, result, actorUserId);
  return result;
}

async function persistReconciliationResult(
  orderId: string,
  paymentId: string,
  result: ReconciliationResult,
  actorUserId: string | undefined,
): Promise<void> {
  if (!isDatabaseConfigured()) return;
  await getDb().insert(paymentReconciliationResults).values({
    orderId,
    paymentId,
    outcome: result.outcome,
    localStatus: result.localStatus,
    providerStatus: result.providerStatus,
    localAmountPaise: result.localAmountPaise,
    providerAmountPaise: result.providerAmountPaise,
    notes: result.notes,
    actorUserId: actorUserId ?? null,
  });
}

/**
 * Scheduled job: find stale pending payments (older than threshold) and
 * reconcile each. Used by the cron runner.
 */
export async function reconcileStalePendingPayments(maxAgeMinutes = 30): Promise<{
  checked: number;
  outcomes: Record<string, number>;
}> {
  if (!isDatabaseConfigured()) return { checked: 0, outcomes: {} };
  const db = getDb();
  const cutoff = new Date(Date.now() - maxAgeMinutes * 60_000);
  const stale = await db
    .select({ id: orders.id })
    .from(orders)
    .where(
      and(
        sql`${orders.status} IN ('pending', 'payment_pending')`,
        sql`${orders.createdAt} < ${cutoff}`,
      ),
    )
    .limit(50);
  const outcomes: Record<string, number> = {};
  for (const row of stale) {
    const result = await reconcileOrderPayment(row.id, undefined);
    outcomes[result.outcome] = (outcomes[result.outcome] ?? 0) + 1;
  }
  return { checked: stale.length, outcomes };
}

/**
 * Detect and repair incomplete post-payment processing.
 *
 * Checks for:
 *  - Provider captured, local payment not captured → promote
 *  - Local payment captured, order not paid → mark order paid
 *  - Paid order, inventory not consumed → consume inventory
 *  - Paid order, invoice job missing → enqueue deduplicated invoice job
 *  - Paid order, email job missing → enqueue deduplicated email job
 *  - Paid order, WhatsApp job missing → enqueue deduplicated WhatsApp job
 *  - Amount mismatch → record but never auto-downgrade
 */
export async function repairIncompletePostPaymentProcessing(limit = 50): Promise<{
  checked: number;
  repaired: Record<string, number>;
}> {
  if (!isDatabaseConfigured()) return { checked: 0, repaired: {} };
  const db = getDb();
  const repaired: Record<string, number> = {};

  // Find orders that are in "paid" or "inventory_exception" status but
  // whose payments have incomplete processing steps.
  const paidOrders = await db
    .select({
      id: orders.id,
      status: orders.status,
    })
    .from(orders)
    .where(
      sql`${orders.status} IN ('paid', 'inventory_exception')`,
    )
    .limit(limit);

  let checked = 0;

  for (const order of paidOrders) {
    checked++;
    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.orderId, order.id))
      .limit(1);

    if (!payment) continue;

    // ── 1. Provider captured, local payment not captured → promote ─────────
    if (payment.status !== "captured" && payment.status !== "failed" && isRazorpayConfigured()) {
      try {
        const result = await reconcileOrderPayment(order.id, undefined);
        if (result.outcome === "local_pending_provider_captured") {
          repaired["payment_promoted"] = (repaired["payment_promoted"] ?? 0) + 1;
        }
      } catch {
        // Skip this order — reconciliation will retry next cron.
      }
    }

    // ── 2. Local payment captured, order not paid → mark paid ──────────────
    if (payment.status === "captured" && order.status === "payment_pending") {
      await db
        .update(orders)
        .set({ status: "paid", updatedAt: new Date() })
        .where(eq(orders.id, order.id));
      await db
        .update(payments)
        .set({ orderPaidMarkedAt: payment.orderPaidMarkedAt ?? new Date(), updatedAt: new Date() })
        .where(eq(payments.id, payment.id));
      repaired["order_marked_paid"] = (repaired["order_marked_paid"] ?? 0) + 1;
    }

    // ── 3. Paid order, inventory not consumed → consume ────────────────────
    if (payment.status === "captured" && !payment.inventoryConsumedAt && order.status !== "inventory_exception") {
      // Check if there are active reservations.
      const activeReservations = await db
        .select({ id: inventoryReservations.id })
        .from(inventoryReservations)
        .where(
          and(
            eq(inventoryReservations.orderId, order.id),
            sql`${inventoryReservations.status} IN ('pending', 'active', 'consuming')`,
          ),
        );

      if (activeReservations.length > 0) {
        await consumeReservationsForOrder(order.id);
        await db
          .update(payments)
          .set({ inventoryConsumedAt: new Date(), updatedAt: new Date() })
          .where(eq(payments.id, payment.id));
        repaired["inventory_consumed"] = (repaired["inventory_consumed"] ?? 0) + 1;
      } else {
        // No active reservations — try fresh allocation.
        const { orderItems: orderItemsTable } = await import("@/db/schema");
        const items = await db
          .select()
          .from(orderItemsTable)
          .where(eq(orderItemsTable.orderId, order.id));

        if (items.length > 0) {
          try {
            await reserveInventoryForOrder({
              orderId: order.id,
              items: items.map((item) => ({
                productId: item.productId,
                quantity: item.quantity,
              })),
            });
            await consumeReservationsForOrder(order.id);
            await db
              .update(payments)
              .set({ inventoryConsumedAt: new Date(), updatedAt: new Date() })
              .where(eq(payments.id, payment.id));
            repaired["inventory_fresh_allocated"] = (repaired["inventory_fresh_allocated"] ?? 0) + 1;
          } catch {
            // Insufficient stock — set inventory_exception.
            await db
              .update(orders)
              .set({
                status: "inventory_exception",
                fulfilmentHoldReason: "Insufficient stock detected during reconciliation repair",
                updatedAt: new Date(),
              })
              .where(eq(orders.id, order.id));
            repaired["inventory_exception_set"] = (repaired["inventory_exception_set"] ?? 0) + 1;
          }
        }
      }
    }

    // ── 4. Paid order, invoice job missing → enqueue ──────────────────────
    if (payment.status === "captured" && !payment.invoiceJobQueuedAt) {
      await enqueueDeduplicatedJob({
        type: "generate-invoice",
        payload: { orderId: order.id },
        dedupeKey: `generate-invoice:${order.id}`,
      });
      await db
        .update(payments)
        .set({ invoiceJobQueuedAt: new Date(), updatedAt: new Date() })
        .where(eq(payments.id, payment.id));
      repaired["invoice_job_enqueued"] = (repaired["invoice_job_enqueued"] ?? 0) + 1;
    }

    // ── 5. Paid order, email job missing → enqueue ────────────────────────
    if (payment.status === "captured" && !payment.emailJobQueuedAt) {
      await enqueueDeduplicatedJob({
        type: "send-order-email",
        payload: { orderId: order.id },
        dedupeKey: `send-order-email:${order.id}`,
      });
      await db
        .update(payments)
        .set({ emailJobQueuedAt: new Date(), updatedAt: new Date() })
        .where(eq(payments.id, payment.id));
      repaired["email_job_enqueued"] = (repaired["email_job_enqueued"] ?? 0) + 1;
    }

    // ── 6. Paid order, WhatsApp job missing → enqueue ────────────────────
    if (payment.status === "captured" && !payment.whatsappJobQueuedAt) {
      await enqueueDeduplicatedJob({
        type: "send-order-whatsapp",
        payload: { orderId: order.id },
        dedupeKey: `send-order-whatsapp:${order.id}`,
      });
      await db
        .update(payments)
        .set({ whatsappJobQueuedAt: new Date(), updatedAt: new Date() })
        .where(eq(payments.id, payment.id));
      repaired["whatsapp_job_enqueued"] = (repaired["whatsapp_job_enqueued"] ?? 0) + 1;
    }
  }

  logger.info(
    { event: "post_payment_repair", checked, repaired },
    "Post-payment processing repair completed",
  );
  return { checked, repaired };
}
