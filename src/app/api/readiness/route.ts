import { NextResponse } from "next/server";
import { sql, eq, lt, and } from "drizzle-orm";
import { isDatabaseConfigured, getDb } from "@/db/client";
import {
  isBlobConfigured,
  isCronConfigured,
  isEmailConfigured,
  isRazorpayConfigured,
  isRazorpayWebhookConfigured,
  isUpstashConfigured,
  isWhatsAppConfigured,
  validateEnvironment,
} from "@/lib/env";
import { getJobQueueHealth } from "@/lib/jobs";
import { brands, categories, checkoutAttempts, inventoryReservations, jobs, orders, payments, paymentWebhookEvents, products, systemRuns, users } from "@/db/schema";

export const dynamic = "force-dynamic";

async function checkDatabase() {
  if (!isDatabaseConfigured()) {
    return { status: "unconfigured" as const, detail: "DATABASE_URL missing" };
  }
  try {
    const db = getDb();
    // Touch one table from each major area to confirm access.
    await db.select({ count: sql<number>`count(*)` }).from(products);
    await db.select({ count: sql<number>`count(*)` }).from(orders);
    await db.select({ count: sql<number>`count(*)` }).from(payments);
    await db.select({ count: sql<number>`count(*)` }).from(users);
    await db.select({ count: sql<number>`count(*)` }).from(brands);
    await db.select({ count: sql<number>`count(*)` }).from(categories);

    // ── Schema readiness check: detect missing migration tables ──────────
    const migrationTables = [
      { name: "payment_webhook_events", table: paymentWebhookEvents },
      { name: "checkout_attempts", table: checkoutAttempts },
      { name: "system_runs", table: systemRuns },
    ];

    for (const { name, table } of migrationTables) {
      try {
        await db.select({ count: sql<number>`count(*)` }).from(table).limit(1);
      } catch (tableError) {
        const message = tableError instanceof Error ? tableError.message.slice(0, 100) : "unknown_error";
        return {
          status: "degraded" as const,
          detail: `Migration pending: table "${name}" not found (${message}). Run migrations before relying on reliability features.`,
        };
      }
    }

    return { status: "ready" as const, detail: "reachable" };
  } catch (error) {
    return {
      status: "degraded" as const,
      detail: error instanceof Error ? error.message.slice(0, 100) : "unknown_error",
    };
  }
}

/**
 * Collect alert-ready signals for operational health monitoring.
 * These are safe to expose on the readiness endpoint (counts only, no PII).
 */
async function collectAlertSignals() {
  if (!isDatabaseConfigured()) {
    return {
      staleProcessingJobs: 0,
      failedWebhookEvents: 0,
      deadLetterJobs: 0,
      deferredJobs: 0,
      inventoryExceptions: 0,
      manualInterventionCheckouts: 0,
      expiredReservations: 0,
    };
  }
  const db = getDb();
  const now = new Date();

  const [staleProcessing] = await db
    .select({ count: sql<number>`count(*)` })
    .from(jobs)
    .where(and(eq(jobs.status, "processing"), lt(jobs.leaseExpiresAt, now)));

  const [failedWebhooks] = await db
    .select({ count: sql<number>`count(*)` })
    .from(paymentWebhookEvents)
    .where(eq(paymentWebhookEvents.processingStatus, "failed"));

  const [deadLetter] = await db
    .select({ count: sql<number>`count(*)` })
    .from(jobs)
    .where(eq(jobs.status, "dead_letter"));

  const [deferred] = await db
    .select({ count: sql<number>`count(*)` })
    .from(jobs)
    .where(eq(jobs.status, "deferred"));

  const [inventoryExceptions] = await db
    .select({ count: sql<number>`count(*)` })
    .from(orders)
    .where(eq(orders.status, "inventory_exception"));

  const [manualIntervention] = await db
    .select({ count: sql<number>`count(*)` })
    .from(checkoutAttempts)
    .where(eq(checkoutAttempts.status, "manual_intervention_required"));

  const [expiredReservations] = await db
    .select({ count: sql<number>`count(*)` })
    .from(inventoryReservations)
    .where(
      and(
        eq(inventoryReservations.status, "active"),
        lt(inventoryReservations.expiresAt, now),
      ),
    );

  return {
    staleProcessingJobs: Number(staleProcessing?.count ?? 0),
    failedWebhookEvents: Number(failedWebhooks?.count ?? 0),
    deadLetterJobs: Number(deadLetter?.count ?? 0),
    deferredJobs: Number(deferred?.count ?? 0),
    inventoryExceptions: Number(inventoryExceptions?.count ?? 0),
    manualInterventionCheckouts: Number(manualIntervention?.count ?? 0),
    expiredReservations: Number(expiredReservations?.count ?? 0),
  };
}

export async function GET() {
  const env = validateEnvironment();
  const database = await checkDatabase();
  const jobHealth = await getJobQueueHealth();
  const alerts = await collectAlertSignals();

  // Determine overall readiness. Any alert signal > 0 means "degraded" but
  // not "unready" — the system can still serve traffic, but operations needs
  // attention.
  const hasAlerts =
    alerts.staleProcessingJobs > 0 ||
    alerts.failedWebhookEvents > 0 ||
    alerts.deadLetterJobs > 0 ||
    alerts.inventoryExceptions > 0 ||
    alerts.manualInterventionCheckouts > 0;

  const overall = database.status === "ready" && !hasAlerts
    ? "ready"
    : database.status === "ready"
      ? "degraded"
      : "unready";

  const response = {
    status: overall,
    timestamp: new Date().toISOString(),
    database,
    razorpay: isRazorpayConfigured() ? "ready" : "unconfigured",
    razorpayWebhook: isRazorpayWebhookConfigured() ? "ready" : "unconfigured",
    email: isEmailConfigured() ? "ready" : "unconfigured",
    whatsapp: isWhatsAppConfigured() ? "ready" : "unconfigured",
    upstash: isUpstashConfigured() ? "ready" : "degraded",
    blob: isBlobConfigured() ? "ready" : "unconfigured",
    cron: isCronConfigured() ? "ready" : "unconfigured",
    auth: process.env.BETTER_AUTH_SECRET ? "ready" : "unconfigured",
    jobQueue: jobHealth,
    alerts,
    blocking: env.blocking,
    degraded: env.degraded,
  };
  // Never include secret values, full database URLs, or provider IDs.
  return NextResponse.json(response, { status: overall === "unready" ? 503 : 200 });
}

