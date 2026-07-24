import { and, eq, lte, sql, inArray, isNull } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/db/client";
import { jobs } from "@/db/schema";
import { logger } from "@/lib/logger";
import { randomUUID } from "node:crypto";
import type { jobStatus } from "@/db/schema";

export type JobStatusValue = (typeof jobStatus.enumValues)[number];

export const JOB_TYPES = [
  "send-order-email",
  "send-order-whatsapp",
  "send-enquiry-email",
  "send-enquiry-whatsapp",
  "generate-invoice",
  "expire-inventory-reservation",
  "reconcile-payment",
  "send-shipment-update",
  "retry-failed-notification",
] as const;
export type JobType = (typeof JOB_TYPES)[number];

export type JobPayload = Record<string, unknown>;

export class JobError extends Error {
  constructor(message: string, public readonly code: string, public readonly retryable = true) {
    super(message);
    this.name = "JobError";
  }
}

/**
 * A deferred job: the channel is unconfigured, so the job cannot be
 * completed. It stays in `deferred` status until the configuration is added
 * and an admin manually retries it.
 */
export class JobDeferredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JobDeferredError";
  }
}

/**
 * Generate a deduplication key for a job. Uses orderId for order-related
 * jobs, reservationId for reservation jobs, etc.
 */
export function jobDedupeKey(type: JobType, payload: Record<string, unknown>): string {
  switch (type) {
    case "generate-invoice":
      return `generate-invoice:${payload.orderId ?? "unknown"}`;
    case "send-order-email":
      return `send-order-email:${payload.orderId ?? "unknown"}`;
    case "send-order-whatsapp":
      return `send-order-whatsapp:${payload.orderId ?? "unknown"}`;
    case "expire-inventory-reservation":
      return `expire-inventory-reservation:${payload.reservationId ?? payload.orderId ?? "unknown"}`;
    case "reconcile-payment":
      return `reconcile-payment:${payload.orderId ?? "unknown"}`;
    case "send-enquiry-email":
      return `send-enquiry-email:${payload.enquiryId ?? "unknown"}`;
    case "send-enquiry-whatsapp":
      return `send-enquiry-whatsapp:${payload.enquiryId ?? "unknown"}`;
    case "send-shipment-update":
      return `send-shipment-update:${payload.orderId ?? "unknown"}`;
    case "retry-failed-notification":
      // These are unique per failure event, so we don't deduplicate them.
      return "";
    default:
      return "";
  }
}

/**
 * Enqueue a job. For deduplicated jobs, use {@link enqueueDeduplicatedJob}.
 */
export async function enqueueJob(input: {
  type: JobType;
  payload: JobPayload;
  runAfter?: Date;
  maxAttempts?: number;
}): Promise<string> {
  if (!isDatabaseConfigured()) {
    logger.warn(
      { event: "job_enqueue_skipped", type: input.type },
      "Job enqueue skipped — database not configured",
    );
    return "";
  }
  const db = getDb();
  const [job] = await db
    .insert(jobs)
    .values({
      type: input.type,
      payload: input.payload,
      runAfter: input.runAfter ?? new Date(),
      maxAttempts: input.maxAttempts ?? 5,
      status: "pending",
    })
    .returning({ id: jobs.id });
  return job?.id ?? "";
}

/**
 * Enqueue a deduplicated job using atomic INSERT ON CONFLICT.
 *
 * The dedupe unique index only covers pending+processing jobs (not completed),
 * so a legitimate resend (e.g. admin "resend email") creates a new job even
 * if an old completed job has the same dedupe key.
 *
 * If a pending or processing job with the same dedupe key already exists,
 * the insert is a no-op and the existing job ID is returned. This is atomic
 * at the database level — two concurrent requests cannot both insert.
 */
export async function enqueueDeduplicatedJob(input: {
  type: JobType;
  payload: JobPayload;
  dedupeKey: string;
  runAfter?: Date;
  maxAttempts?: number;
}): Promise<string> {
  if (!isDatabaseConfigured()) {
    logger.warn(
      { event: "job_enqueue_skipped", type: input.type },
      "Job enqueue skipped — database not configured",
    );
    return "";
  }
  const db = getDb();

  if (!input.dedupeKey) {
    return enqueueJob({
      type: input.type,
      payload: input.payload,
      runAfter: input.runAfter,
      maxAttempts: input.maxAttempts,
    });
  }

  // Atomic INSERT ON CONFLICT. If a pending/processing job with this dedupe
  // key exists, the insert is skipped and we return the existing job's ID.
  const inserted = await db
    .insert(jobs)
    .values({
      type: input.type,
      payload: input.payload,
      runAfter: input.runAfter ?? new Date(),
      maxAttempts: input.maxAttempts ?? 5,
      status: "pending",
      dedupeKey: input.dedupeKey,
    })
    .onConflictDoNothing({
      target: jobs.dedupeKey,
      where: sql`${jobs.status} IN ('pending', 'processing')`,
    })
    .returning({ id: jobs.id });

  if (inserted.length > 0) {
    return inserted[0].id;
  }

  // Insert was skipped — a pending/processing job with this dedupe key exists.
  // Load and return its ID.
  const [existing] = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(
      and(
        eq(jobs.dedupeKey, input.dedupeKey),
        inArray(jobs.status, ["pending", "processing"]),
      ),
    )
    .limit(1);

  logger.info(
    { event: "job_dedupe_existing", dedupeKey: input.dedupeKey, existingJobId: existing?.id },
    "Deduplicated job already exists",
  );
  return existing?.id ?? "";
}

/**
 * Claim a batch of pending jobs for processing using the atomic `claim_jobs`
 * PostgreSQL function. The function uses a CTE with FOR UPDATE SKIP LOCKED
 * to claim exactly `batchSize` jobs — no more, no less. Two concurrent
 * workers cannot claim the same job.
 *
 * Each claimed job gets a lease that expires after `leaseSeconds`. If the
 * worker crashes, the lease expires and {@link reclaimStaleJobs} returns the
 * job to pending (or dead-letters it after too many recoveries).
 */
export async function claimJobs(input: {
  workerId?: string;
  batchSize?: number;
  leaseSeconds?: number;
}): Promise<Array<{ id: string; type: string; payload: JobPayload; attempts: number; maxAttempts: number }>> {
  if (!isDatabaseConfigured()) return [];
  const db = getDb();
  const workerId = input.workerId ?? `worker-${randomUUID()}`;
  const batchSize = Math.min(input.batchSize ?? 5, 25);
  const leaseSeconds = input.leaseSeconds ?? 120;

  try {
    const result = await db.execute(sql`
      SELECT * FROM claim_jobs(
        ${workerId}::text,
        ${batchSize}::integer,
        ${leaseSeconds}::integer
      )
    `);
    const rows = Array.isArray(result) ? result : ((result as { rows?: Array<Record<string, unknown>> }).rows ?? []);
    return rows.map((row) => ({
      id: String(row.id),
      type: String(row.type),
      payload: row.payload as JobPayload,
      attempts: Number(row.attempts),
      maxAttempts: Number(row.max_attempts),
    }));
  } catch (error) {
    logger.error(
      { event: "claim_jobs_failed", error: error instanceof Error ? error.message : "unknown" },
      "Failed to claim jobs",
    );
    return [];
  }
}

/** Mark a job as successfully completed. */
export async function completeJob(jobId: string): Promise<void> {
  if (!isDatabaseConfigured()) return;
  await getDb()
    .update(jobs)
    .set({
      status: "completed",
      completedAt: new Date(),
      lastError: null,
      lockedAt: null,
      lockedBy: null,
      leaseExpiresAt: null,
      updatedAt: new Date(),
    })
    .where(eq(jobs.id, jobId));
}

/**
 * Mark a job as failed. If attempts < maxAttempts, the job is returned to
 * `pending` state with an exponential backoff. Otherwise it is moved to
 * `dead_letter` (not `failed` — `dead_letter` is the terminal state for
 * jobs that exhausted all retries).
 */
export async function failJob(jobId: string, error: unknown): Promise<void> {
  if (!isDatabaseConfigured()) return;
  const db = getDb();
  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
  if (!job) return;
  const message = error instanceof Error ? error.message : String(error).slice(0, 500);
  const exhausted = job.attempts >= job.maxAttempts;
  if (exhausted) {
    await db
      .update(jobs)
      .set({
        status: "dead_letter",
        lastError: message,
        lockedAt: null,
        lockedBy: null,
        leaseExpiresAt: null,
        updatedAt: new Date(),
      })
      .where(eq(jobs.id, jobId));
    logger.error(
      { event: "job_dead_lettered", jobId, type: job.type, attempts: job.attempts, maxAttempts: job.maxAttempts },
      "Job moved to dead_letter after exhausting retries",
    );
    return;
  }
  // Exponential backoff: 30s, 2min, 8min, 32min, 2h...
  const backoffSeconds = 30 * Math.pow(4, job.attempts - 1);
  const runAfter = new Date(Date.now() + backoffSeconds * 1000);
  await db
    .update(jobs)
    .set({
      status: "pending",
      lastError: message,
      lockedAt: null,
      lockedBy: null,
      leaseExpiresAt: null,
      runAfter,
      updatedAt: new Date(),
    })
    .where(eq(jobs.id, jobId));
}

/**
 * Defer a job — the channel is unconfigured, so the job cannot be completed.
 * The job stays in `deferred` status until the configuration is added and
 * an admin manually retries it. This prevents false completion.
 */
export async function deferJob(jobId: string, reason: string): Promise<void> {
  if (!isDatabaseConfigured()) return;
  await getDb()
    .update(jobs)
    .set({
      status: "deferred",
      lastError: reason.slice(0, 500),
      lockedAt: null,
      lockedBy: null,
      leaseExpiresAt: null,
      updatedAt: new Date(),
    })
    .where(eq(jobs.id, jobId));
  logger.warn(
    { event: "job_deferred", jobId, reason },
    "Job deferred — channel unconfigured",
  );
}

/**
 * Cancel a job. Used by admin actions to stop retrying a failing job.
 */
export async function cancelJob(jobId: string): Promise<void> {
  if (!isDatabaseConfigured()) return;
  await getDb()
    .update(jobs)
    .set({
      status: "cancelled",
      lockedAt: null,
      lockedBy: null,
      leaseExpiresAt: null,
      updatedAt: new Date(),
    })
    .where(eq(jobs.id, jobId));
}

/**
 * Reclaim stale jobs — processing jobs whose lease has expired. Uses the
 * atomic `reclaim_stale_jobs` PostgreSQL function. Jobs that have been
 * reclaimed too many times (or have exhausted attempts) are moved to
 * `dead_letter`.
 */
export async function reclaimStaleJobs(maxRecoveries = 3): Promise<{ reclaimed: number; deadLettered: number }> {
  if (!isDatabaseConfigured()) return { reclaimed: 0, deadLettered: 0 };
  const db = getDb();
  try {
    const result = await db.execute(sql`
      SELECT * FROM reclaim_stale_jobs(${maxRecoveries}::integer)
    `);
    const rows = Array.isArray(result) ? result : ((result as { rows?: Array<Record<string, unknown>> }).rows ?? []);
    let reclaimed = 0;
    let deadLettered = 0;
    for (const row of rows) {
      if (row.action === "reclaimed") reclaimed++;
      else if (row.action === "dead_lettered") deadLettered++;
    }
    if (reclaimed > 0 || deadLettered > 0) {
      logger.info(
        { event: "stale_jobs_reclaimed", reclaimed, deadLettered },
        "Reclaimed stale processing jobs",
      );
    }
    return { reclaimed, deadLettered };
  } catch (error) {
    logger.error(
      { event: "reclaim_stale_jobs_failed", error: error instanceof Error ? error.message : "unknown" },
      "Failed to reclaim stale jobs",
    );
    return { reclaimed: 0, deadLettered: 0 };
  }
}

/**
 * Run one batch of jobs. Claims jobs, dispatches each, and marks the
 * outcome. Reclaims stale jobs before claiming to recover crashed workers.
 */
export async function runJobBatch(input: {
  workerId?: string;
  batchSize?: number;
}): Promise<{ claimed: number; completed: number; failed: number; deferred: number }> {
  // Reclaim stale jobs first.
  await reclaimStaleJobs();

  const claimed = await claimJobs(input);
  if (claimed.length === 0) return { claimed: 0, completed: 0, failed: 0, deferred: 0 };

  const { dispatchJob } = await import("@/lib/job-dispatcher");
  let completed = 0;
  let failed = 0;
  let deferred = 0;
  for (const job of claimed) {
    try {
      await dispatchJob(job as { id: string; type: JobType; payload: JobPayload });
      await completeJob(job.id);
      completed++;
    } catch (error) {
      if (error instanceof JobDeferredError) {
        await deferJob(job.id, error.message);
        deferred++;
      } else {
        await failJob(job.id, error);
        failed++;
        logger.warn(
          {
            event: "job_failed",
            jobId: job.id,
            type: job.type,
            error: error instanceof Error ? error.message : "unknown",
          },
          "Job execution failed",
        );
      }
    }
  }
  return { claimed: claimed.length, completed, failed, deferred };
}

/**
 * Health monitoring data for the job queue. Used by the readiness endpoint
 * and admin dashboard.
 */
export async function getJobQueueHealth(): Promise<{
  pendingCount: number;
  processingCount: number;
  staleProcessingCount: number;
  failedCount: number;
  deadLetterCount: number;
  deferredCount: number;
  oldestPendingAge: number | null;
}> {
  if (!isDatabaseConfigured()) {
    return {
      pendingCount: 0,
      processingCount: 0,
      staleProcessingCount: 0,
      failedCount: 0,
      deadLetterCount: 0,
      deferredCount: 0,
      oldestPendingAge: null,
    };
  }
  const db = getDb();
  const now = new Date();

  const [pending] = await db
    .select({ count: sql<number>`count(*)` })
    .from(jobs)
    .where(eq(jobs.status, "pending"));
  const [processing] = await db
    .select({ count: sql<number>`count(*)` })
    .from(jobs)
    .where(eq(jobs.status, "processing"));
  const [stale] = await db
    .select({ count: sql<number>`count(*)` })
    .from(jobs)
    .where(
      and(
        eq(jobs.status, "processing"),
        lte(jobs.leaseExpiresAt, now),
      ),
    );
  const [failed] = await db
    .select({ count: sql<number>`count(*)` })
    .from(jobs)
    .where(eq(jobs.status, "failed"));
  const [deadLetter] = await db
    .select({ count: sql<number>`count(*)` })
    .from(jobs)
    .where(eq(jobs.status, "dead_letter"));
  const [deferred] = await db
    .select({ count: sql<number>`count(*)` })
    .from(jobs)
    .where(eq(jobs.status, "deferred"));

  const [oldest] = await db
    .select({ createdAt: jobs.createdAt })
    .from(jobs)
    .where(eq(jobs.status, "pending"))
    .orderBy(jobs.createdAt)
    .limit(1);

  const oldestPendingAge = oldest
    ? Math.floor((now.getTime() - oldest.createdAt.getTime()) / 1000)
    : null;

  return {
    pendingCount: Number(pending?.count ?? 0),
    processingCount: Number(processing?.count ?? 0),
    staleProcessingCount: Number(stale?.count ?? 0),
    failedCount: Number(failed?.count ?? 0),
    deadLetterCount: Number(deadLetter?.count ?? 0),
    deferredCount: Number(deferred?.count ?? 0),
    oldestPendingAge,
  };
}
