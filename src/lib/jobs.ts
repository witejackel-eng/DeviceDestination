import { and, asc, eq, gt, lte, sql } from "drizzle-orm";
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
 * Enqueue a job. Idempotency is the caller's responsibility — for example, an
 * invoice-generation job for a given order should include the order ID in the
 * payload and the caller should check before enqueueing.
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
 * Claim a batch of pending jobs for processing. Uses an atomic conditional
 * UPDATE to ensure two workers cannot claim the same job.
 *
 * Returns the claimed jobs. The caller MUST call either {@link completeJob}
 * or {@link failJob} for each claimed job.
 */
export async function claimJobs(input: {
  workerId?: string;
  batchSize?: number;
  types?: JobType[];
}): Promise<Array<{ id: string; type: string; payload: JobPayload; attempts: number; maxAttempts: number }>> {
  if (!isDatabaseConfigured()) return [];
  const db = getDb();
  const workerId = input.workerId ?? `worker-${randomUUID()}`;
  const batchSize = Math.min(input.batchSize ?? 5, 25);
  const now = new Date();

  // Pick pending jobs whose runAfter has passed. We use a single atomic
  // UPDATE...RETURNING to claim them; this is safe even on neon-http.
  const conditions = [
    eq(jobs.status, "pending"),
    lte(jobs.runAfter, now),
  ];
  const claimed = await db
    .update(jobs)
    .set({
      status: "processing",
      lockedAt: now,
      lockedBy: workerId,
      attempts: sql`${jobs.attempts} + 1`,
      updatedAt: now,
    })
    .where(and(...conditions))
    .returning({
      id: jobs.id,
      type: jobs.type,
      payload: jobs.payload,
      attempts: jobs.attempts,
      maxAttempts: jobs.maxAttempts,
    });

  // Limit to batchSize (the atomic UPDATE may have claimed more if concurrent
  // — but in practice only this worker's claim succeeds for each row).
  const limited = claimed.slice(0, batchSize);
  // If we claimed more than we should process, release the extras.
  if (claimed.length > batchSize) {
    const extras = claimed.slice(batchSize);
    for (const extra of extras) {
      await db
        .update(jobs)
        .set({
          status: "pending",
          lockedAt: null,
          lockedBy: null,
          attempts: sql`GREATEST(${jobs.attempts} - 1, 0)`,
          updatedAt: new Date(),
        })
        .where(eq(jobs.id, extra.id));
    }
  }
  return limited;
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
      updatedAt: new Date(),
    })
    .where(eq(jobs.id, jobId));
}

/**
 * Mark a job as failed. If attempts < maxAttempts, the job is returned to
 * `pending` state with an exponential backoff. Otherwise it is marked as
 * `failed` permanently.
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
        status: "failed",
        lastError: message,
        updatedAt: new Date(),
      })
      .where(eq(jobs.id, jobId));
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
      runAfter,
      updatedAt: new Date(),
    })
    .where(eq(jobs.id, jobId));
}

/**
 * Cancel a job. Used by admin actions to stop retrying a failing job.
 */
export async function cancelJob(jobId: string): Promise<void> {
  if (!isDatabaseConfigured()) return;
  await getDb()
    .update(jobs)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(eq(jobs.id, jobId));
}

/**
 * Run one batch of jobs. Imports the dispatcher dynamically to avoid pulling
 * notification/fulfilment modules into the import graph at module load.
 */
export async function runJobBatch(input: {
  workerId?: string;
  batchSize?: number;
}): Promise<{ claimed: number; completed: number; failed: number }> {
  const claimed = await claimJobs(input);
  if (claimed.length === 0) return { claimed: 0, completed: 0, failed: 0 };
  const { dispatchJob } = await import("@/lib/job-dispatcher");
  let completed = 0;
  let failed = 0;
  for (const job of claimed) {
    try {
      await dispatchJob(job as { id: string; type: JobType; payload: JobPayload });
      await completeJob(job.id);
      completed++;
    } catch (error) {
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
  return { claimed: claimed.length, completed, failed };
}
