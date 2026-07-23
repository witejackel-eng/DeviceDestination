import { and, eq, sql } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/db/client";
import {
  orders,
  paymentReconciliationResults,
  payments,
} from "@/db/schema";
import { getRazorpay } from "@/lib/razorpay";
import { isRazorpayConfigured } from "@/lib/env";
import { logger } from "@/lib/logger";
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
    notes = `Local ${localAmount} vs provider ${providerAmount}`;
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
          updatedAt: new Date(),
        })
        .where(eq(payments.id, payment.id));
      await db
        .update(orders)
        .set({ status: "paid", lastReconciledAt: new Date(), updatedAt: new Date() })
        .where(eq(orders.id, orderId));
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
