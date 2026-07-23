/**
 * Admin operational alerts — provides counts of various operational issues
 * that require attention. These are queryable from the admin dashboard.
 *
 * All counts are real, derived from the database. No fake analytics.
 */

import { and, eq, isNull, lte, sql } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/db/client";
import {
  checkoutAttempts,
  inventoryReservations,
  jobs,
  orders,
  paymentWebhookEvents,
  payments,
  systemRuns,
} from "@/db/schema";
import { logger } from "@/lib/logger";

export type AdminAlertCounts = {
  failedWebhookProcessing: number;
  paidOrdersWithIncompleteInventory: number;
  paidOrdersMissingNotificationJobs: number;
  inventoryExceptions: number;
  stuckReservations: number;
  stuckCheckoutAttempts: number;
  failedReconciliation: number;
  failedBackgroundJobs: number;
  missingMigrations: number;
  staleCron: boolean;
  lastCronRunAt: string | null;
};

/**
 * Get all admin operational alert counts. Returns real counts from the
 * database, no fake analytics.
 */
export async function getAdminAlertCounts(): Promise<AdminAlertCounts> {
  if (!isDatabaseConfigured()) {
    return {
      failedWebhookProcessing: 0,
      paidOrdersWithIncompleteInventory: 0,
      paidOrdersMissingNotificationJobs: 0,
      inventoryExceptions: 0,
      stuckReservations: 0,
      stuckCheckoutAttempts: 0,
      failedReconciliation: 0,
      failedBackgroundJobs: 0,
      missingMigrations: 0,
      staleCron: false,
      lastCronRunAt: null,
    };
  }
  const db = getDb();

  // ── Failed webhook processing ──────────────────────────────────────────
  const [failedWebhook] = await db
    .select({ count: sql<number>`count(*)` })
    .from(paymentWebhookEvents)
    .where(eq(paymentWebhookEvents.processingStatus, "failed"));

  // ── Paid orders with incomplete inventory consumption ──────────────────
  // Orders that are "paid" but their payment record has no inventoryConsumedAt.
  const [paidIncompleteInventory] = await db
    .select({ count: sql<number>`count(*)` })
    .from(orders)
    .innerJoin(payments, eq(payments.orderId, orders.id))
    .where(
      and(
        sql`${orders.status} IN ('paid', 'inventory_exception')`,
        isNull(payments.inventoryConsumedAt),
      ),
    );

  // ── Paid orders missing notification jobs ──────────────────────────────
  const [paidMissingInvoice] = await db
    .select({ count: sql<number>`count(*)` })
    .from(orders)
    .innerJoin(payments, eq(payments.orderId, orders.id))
    .where(
      and(
        eq(orders.status, "paid"),
        isNull(payments.invoiceJobQueuedAt),
      ),
    );

  const [paidMissingEmail] = await db
    .select({ count: sql<number>`count(*)` })
    .from(orders)
    .innerJoin(payments, eq(payments.orderId, orders.id))
    .where(
      and(
        eq(orders.status, "paid"),
        isNull(payments.emailJobQueuedAt),
      ),
    );

  const [paidMissingWhatsapp] = await db
    .select({ count: sql<number>`count(*)` })
    .from(orders)
    .innerJoin(payments, eq(payments.orderId, orders.id))
    .where(
      and(
        eq(orders.status, "paid"),
        isNull(payments.whatsappJobQueuedAt),
      ),
    );

  const paidOrdersMissingNotificationJobs =
    paidMissingInvoice.count + paidMissingEmail.count + paidMissingWhatsapp.count;

  // ── Inventory exceptions ───────────────────────────────────────────────
  const [inventoryExceptions] = await db
    .select({ count: sql<number>`count(*)` })
    .from(orders)
    .where(eq(orders.status, "inventory_exception"));

  // ── Stuck reservations ─────────────────────────────────────────────────
  // Reservations in "pending" state for > 2 minutes, or "consuming"/"releasing"
  // for > 5 minutes.
  const now = new Date();
  const stalePendingCutoff = new Date(now.getTime() - 2 * 60_000);
  const staleTransitionCutoff = new Date(now.getTime() - 5 * 60_000);

  const [stuckPendingReservations] = await db
    .select({ count: sql<number>`count(*)` })
    .from(inventoryReservations)
    .where(
      and(
        eq(inventoryReservations.status, "pending"),
        lte(inventoryReservations.createdAt, stalePendingCutoff),
      ),
    );

  const [stuckTransitionReservations] = await db
    .select({ count: sql<number>`count(*)` })
    .from(inventoryReservations)
    .where(
      and(
        sql`${inventoryReservations.status} IN ('consuming', 'releasing')`,
        lte(inventoryReservations.updatedAt, staleTransitionCutoff),
      ),
    );

  const stuckReservations = stuckPendingReservations.count + stuckTransitionReservations.count;

  // ── Stuck checkout attempts ────────────────────────────────────────────
  // Checkout attempts stuck in processing states for > 10 minutes.
  const staleCheckoutCutoff = new Date(now.getTime() - 10 * 60_000);
  const [stuckCheckout] = await db
    .select({ count: sql<number>`count(*)` })
    .from(checkoutAttempts)
    .where(
      and(
        sql`${checkoutAttempts.status} IN ('initialized', 'local_order_created', 'inventory_reserved', 'provider_order_creating')`,
        lte(checkoutAttempts.updatedAt, staleCheckoutCutoff),
      ),
    );

  // ── Failed reconciliation ──────────────────────────────────────────────
  // Look for reconciliation results with non-match outcomes.
  const { paymentReconciliationResults } = await import("@/db/schema");
  const [failedRecon] = await db
    .select({ count: sql<number>`count(*)` })
    .from(paymentReconciliationResults)
    .where(
      sql`${paymentReconciliationResults.outcome} NOT IN ('match', 'duplicate_event')`,
    );

  // ── Failed background jobs ─────────────────────────────────────────────
  const [failedJobs] = await db
    .select({ count: sql<number>`count(*)` })
    .from(jobs)
    .where(eq(jobs.status, "failed"));

  // ── Missing migrations ─────────────────────────────────────────────────
  // Check if new reliability tables exist.
  let missingMigrations = 0;
  const migrationChecks = [
    { name: "payment_webhook_events", table: paymentWebhookEvents },
    { name: "checkout_attempts", table: checkoutAttempts },
    { name: "system_runs", table: systemRuns },
  ];
  for (const { name, table } of migrationChecks) {
    try {
      await db.select({ count: sql<number>`count(*)` }).from(table).limit(1);
    } catch {
      missingMigrations++;
      logger.warn(
        { event: "missing_migration_table", tableName: name },
        `Migration table "${name}" not found`,
      );
    }
  }

  // ── Stale cron ──────────────────────────────────────────────────────────
  // Check if the last cron run was > 30 minutes ago.
  let staleCron = false;
  let lastCronRunAt: string | null = null;
  try {
    const [lastRun] = await db
      .select()
      .from(systemRuns)
      .orderBy(sql`${systemRuns.startedAt} DESC`)
      .limit(1);

    if (lastRun) {
      lastCronRunAt = lastRun.startedAt.toISOString();
      const staleCronThreshold = 30 * 60_000; // 30 minutes
      staleCron = Date.now() - lastRun.startedAt.getTime() > staleCronThreshold;
    }
  } catch {
    // systemRuns table may not exist yet.
  }

  return {
    failedWebhookProcessing: failedWebhook.count,
    paidOrdersWithIncompleteInventory: paidIncompleteInventory.count,
    paidOrdersMissingNotificationJobs,
    inventoryExceptions: inventoryExceptions.count,
    stuckReservations,
    stuckCheckoutAttempts: stuckCheckout.count,
    failedReconciliation: failedRecon.count,
    failedBackgroundJobs: failedJobs.count,
    missingMigrations,
    staleCron,
    lastCronRunAt,
  };
}
