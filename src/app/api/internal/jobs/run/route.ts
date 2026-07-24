import { NextRequest, NextResponse } from "next/server";
import { runJobBatch, reclaimStaleJobs } from "@/lib/jobs";
import { reconcileStalePendingPayments, repairIncompletePostPaymentProcessing } from "@/lib/reconciliation";
import { expirePendingReservations } from "@/lib/inventory";
import { recoverStaleCheckoutAttempts } from "@/lib/checkout-orchestrator";
import { isCronConfigured } from "@/lib/env";
import { logger } from "@/lib/logger";
import { getDb, isDatabaseConfigured } from "@/db/client";
import { systemRuns } from "@/db/schema";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Internal cron-protected job runner. Triggered by Vercel Cron (or any
 * authenticated caller with CRON_SECRET). Runs one batch of pending jobs,
 * then sweeps stale reservations, stale pending payments, and repairs
 * incomplete post-payment processing.
 *
 * After each run, inserts a systemRuns record with the results.
 *
 * Security:
 *  - If CRON_SECRET is set, the request MUST include a matching
 *    `authorization: Bearer <secret>` header OR Vercel-Cron-Auth header.
 *  - If CRON_SECRET is NOT set, this endpoint refuses to run (returns 503).
 *  - Never exposed publicly.
 */
export async function POST(request: NextRequest) {
  if (!isCronConfigured()) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured — job runner is disabled." },
      { status: 503 },
    );
  }
  const authHeader = request.headers.get("authorization") ?? "";
  const vercelCronAuth = request.headers.get("x-vercel-cron-auth") ?? "";
  const secret = process.env.CRON_SECRET!;
  const authorised = authHeader === `Bearer ${secret}` || vercelCronAuth === secret;
  if (!authorised) {
    logger.warn({ event: "cron_unauthorized" }, "Unauthorized cron invocation");
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  // Determine trigger source.
  const triggerSource = vercelCronAuth === secret ? "vercel_cron" : "manual";
  const startedAt = new Date();

  const jobsResult = await runJobBatch({ batchSize: 10 });
  const staleJobsResult = await reclaimStaleJobs();
  const reservationResult = await expirePendingReservations();
  const reconciliationResult = await reconcileStalePendingPayments(30);
  const repairResult = await repairIncompletePostPaymentProcessing(50);
  const staleCheckoutResult = await recoverStaleCheckoutAttempts({ limit: 50 });

  const completedAt = new Date();
  const durationMs = completedAt.getTime() - startedAt.getTime();

  // ── Insert systemRuns record ────────────────────────────────────────────
  if (isDatabaseConfigured()) {
    try {
      const db = getDb();
      await db.insert(systemRuns).values({
        triggerSource,
        jobsClaimed: jobsResult.claimed,
        jobsCompleted: jobsResult.completed,
        jobsFailed: jobsResult.failed,
        reservationsExpired: reservationResult.expired,
        paymentsReconciled: reconciliationResult.checked,
        durationMs,
        startedAt,
        completedAt,
      });
    } catch (error) {
      // System runs recording is best-effort — don't fail the cron run.
      logger.warn(
        { event: "system_runs_insert_failed", error: error instanceof Error ? error.message : "unknown" },
        "Failed to record system run",
      );
    }
  }

  logger.info(
    {
      event: "cron_run_complete",
      triggerSource,
      durationMs,
      jobs: jobsResult,
      staleJobs: staleJobsResult,
      reservations: reservationResult.expired,
      reconciliation: reconciliationResult,
      repair: repairResult,
      staleCheckout: staleCheckoutResult,
    },
    "Cron run complete",
  );

  return NextResponse.json({
    jobs: jobsResult,
    staleJobs: staleJobsResult,
    reservationsExpired: reservationResult.expired,
    reconciliation: reconciliationResult,
    repair: repairResult,
    staleCheckout: staleCheckoutResult,
    durationMs,
    triggerSource,
    timestamp: completedAt.toISOString(),
  });
}

export async function GET(request: NextRequest) {
  // Vercel Cron sends GET by default.
  return POST(request);
}
