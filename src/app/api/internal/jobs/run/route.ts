import { NextRequest, NextResponse } from "next/server";
import { runJobBatch } from "@/lib/jobs";
import { reconcileStalePendingPayments } from "@/lib/reconciliation";
import { expirePendingReservations } from "@/lib/inventory";
import { isCronConfigured } from "@/lib/env";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Internal cron-protected job runner. Triggered by Vercel Cron (or any
 * authenticated caller with CRON_SECRET). Runs one batch of pending jobs,
 * then sweeps stale reservations and stale pending payments.
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

  const jobsResult = await runJobBatch({ batchSize: 10 });
  const reservationResult = await expirePendingReservations();
  const reconciliationResult = await reconcileStalePendingPayments(30);

  logger.info(
    {
      event: "cron_run_complete",
      jobs: jobsResult,
      reservations: reservationResult.expired,
      reconciliation: reconciliationResult,
    },
    "Cron run complete",
  );

  return NextResponse.json({
    jobs: jobsResult,
    reservationsExpired: reservationResult.expired,
    reconciliation: reconciliationResult,
    timestamp: new Date().toISOString(),
  });
}

export async function GET(request: NextRequest) {
  // Vercel Cron sends GET by default.
  return POST(request);
}
