# Job Runner

This document explains the durable, database-backed job runner.

## Why database-backed?

Serverless environments (Vercel) do not provide a long-running process. External queue providers (SQS, Inngest, etc.) cost money and add operational complexity. The `jobs` table provides a durable, retryable, serverless-friendly job queue using only PostgreSQL.

## Schema

The `jobs` table:

- `id` — UUID primary key.
- `type` — one of the values in `JOB_TYPES` (`src/lib/jobs.ts`).
- `payload` — JSONB. Caller is responsible for shape.
- `status` — `pending`, `processing`, `completed`, `failed`, `cancelled`.
- `attempts` — incremented on each claim.
- `max_attempts` — default 5.
- `run_after` — earliest time this job should be picked up. Used for exponential backoff.
- `locked_at`, `locked_by` — set when a worker claims the job.
- `last_error` — captured on failure.
- `completed_at` — set on success.
- `dedupe_key` — optional deduplication key. If set, prevents duplicate active jobs with the same key.

Indexes:

- `(status, run_after)` — for the claim query.
- `(type)` — for per-type admin views.
- `(locked_by)` — for stale-lock detection.
- `(dedupe_key) WHERE status IN ('pending', 'processing', 'completed')` — partial unique index for deduplication.

## Job deduplication

`enqueueDeduplicatedJob({ type, payload, dedupeKey, runAfter?, maxAttempts? })` checks whether an active job (status `pending`, `processing`, or `completed`) with the same `dedupeKey` already exists. If it does, the existing job's ID is returned without creating a duplicate. If not, a new row is inserted with the `dedupeKey`.

The partial unique index `jobs_dedupe_key_active_idx` enforces this at the database level:

```sql
CREATE UNIQUE INDEX jobs_dedupe_key_active_idx
ON jobs (dedupe_key)
WHERE status IN ('pending', 'processing', 'completed');
```

Failed or cancelled jobs are excluded from the deduplication check, so a new job with the same key can be created after a previous one has permanently failed.

### Dedupe key format examples

| Job type | Dedupe key format | Example |
|----------|-------------------|---------|
| `generate-invoice` | `generate-invoice:<orderId>` | `generate-invoice:abc123` |
| `send-order-email` | `send-order-email:<orderId>` | `send-order-email:abc123` |
| `send-order-whatsapp` | `send-order-whatsapp:<orderId>` | `send-order-whatsapp:abc123` |
| `expire-inventory-reservation` | `expire-inventory-reservation:<reservationId>` or `expire-inventory-reservation:<orderId>` | `expire-inventory-reservation:res456` |
| `reconcile-payment` | `reconcile-payment:<orderId>` | `reconcile-payment:abc123` |
| `send-enquiry-email` | `send-enquiry-email:<enquiryId>` | `send-enquiry-email:enq789` |
| `send-enquiry-whatsapp` | `send-enquiry-whatsapp:<enquiryId>` | `send-enquiry-whatsapp:enq789` |
| `send-shipment-update` | `send-shipment-update:<orderId>` | `send-shipment-update:abc123` |
| `retry-failed-notification` | *(no dedupe key — each failure event is unique)* | — |
| Admin alert | `admin-alert:inventory_exception:<orderId>` | `admin-alert:inventory_exception:abc123` |

The `jobDedupeKey` function in `src/lib/jobs.ts` computes the dedupe key from the job type and payload. Callers can also pass a custom `dedupeKey` to `enqueueDeduplicatedJob`.

## Enqueue

`enqueueJob({ type, payload, runAfter?, maxAttempts? })` inserts a row with `status = 'pending'`. Returns the job ID. For deduplicated jobs, use `enqueueDeduplicatedJob` instead (see below).

`enqueueDeduplicatedJob({ type, payload, dedupeKey, runAfter?, maxAttempts? })` checks for an existing active job with the same `dedupeKey`. If found, returns the existing job ID. If not, inserts a new row with `dedupeKey` set. This is the preferred method for order-related jobs to prevent duplicate invoices, emails, and WhatsApp messages for the same order.

## Claim

`claimJobs({ workerId?, batchSize?, types? })` uses an atomic conditional UPDATE to claim jobs:

```sql
UPDATE jobs
SET status = 'processing',
    locked_at = now(),
    locked_by = $1,
    attempts = attempts + 1,
    updated_at = now()
WHERE status = 'pending'
  AND run_after <= now()
RETURNING *;
```

This is safe even with concurrent workers — Postgres row-level locking ensures only one worker claims each job. The caller limits the result to `batchSize` and releases extras (if any) back to `pending`.

## Complete and fail

`completeJob(jobId)` sets `status = 'completed'` and `completed_at = now()`.

`failJob(jobId, error)` checks if `attempts >= max_attempts`:

- If exhausted: `status = 'failed'` permanently.
- Otherwise: `status = 'pending'`, `run_after = now + 30s × 4^(attempts-1)` (exponential backoff: 30s, 2m, 8m, 32m, 2h).

## Dispatcher

`dispatchJob({ id, type, payload })` in `src/lib/job-dispatcher.ts` maps each job type to a handler:

| Type | Handler |
|------|---------|
| `send-order-email` | `handleSendOrderEmail` |
| `send-order-whatsapp` | `handleSendOrderWhatsapp` |
| `send-enquiry-email` | `handleSendEnquiryEmail` |
| `send-enquiry-whatsapp` | `handleSendEnquiryWhatsapp` |
| `generate-invoice` | `handleGenerateInvoice` |
| `expire-inventory-reservation` | `handleExpireReservations` |
| `reconcile-payment` | `handleReconcilePayment` |
| `send-shipment-update` | `handleSendShipmentUpdate` |
| `retry-failed-notification` | `handleRetryFailedNotification` |

Handlers MUST:

- Be idempotent (safe to retry).
- Throw `JobError` for retryable failures.
- Return silently on success.
- Tolerate missing configuration (e.g. email not configured) by recording a safe skipped state and returning normally.

## Cron endpoint

`POST /api/internal/jobs/run` (also handles `GET` for Vercel Cron):

1. Refuses to run if `CRON_SECRET` is not set.
2. Requires either `Authorization: Bearer <secret>` or `x-vercel-cron-auth: <secret>`.
3. Runs one batch of up to 10 jobs via `runJobBatch`.
4. Calls `expirePendingReservations` to release stale reservations.
5. Calls `reconcileStalePendingPayments(30)` to reconcile payments older than 30 minutes.
6. Calls `repairIncompletePostPaymentProcessing(50)` to fill in missing processing steps for paid/inventory_exception orders.
7. Inserts a `system_runs` record with the run results (best-effort).
8. Returns a summary of the run.

`vercel.json` configures Vercel Cron to hit this endpoint daily (`0 2 * * *`). For production-grade reliability (especially for 15-minute reservation expiry), an external scheduler should hit this endpoint more frequently (every 5–10 minutes). See [Backend Activation Checklist](backend-activation-checklist.md) for setup instructions.

## System runs table

The `system_runs` table records each cron run:

- `id` — UUID primary key.
- `trigger_source` — `vercel_cron` or `manual`.
- `jobs_claimed` — number of jobs claimed in this run.
- `jobs_completed` — number of jobs completed.
- `jobs_failed` — number of jobs that failed.
- `reservations_expired` — number of expired reservations released.
- `payments_reconciled` — number of payments reconciled.
- `duration_ms` — total run duration in milliseconds.
- `error` — any error message (nullable).
- `started_at` — when the run started.
- `completed_at` — when the run completed.

This provides operational visibility into cron run frequency, duration, and effectiveness. Recording is best-effort — a failure to insert does not abort the cron run.

## Admin UI

Visit `/admin/audit?tab=jobs` to see the most recent 100 jobs with their type, status, attempts, run-after, last error, and creation time.

Visit `/api/admin/jobs/[id]/cancel` (POST, admin-authorized) to cancel a stuck job.

## Failure modes

- **Two workers claim the same job** — prevented by the atomic conditional UPDATE.
- **Worker dies mid-job** — the job remains in `processing` with `locked_at` set. The cron sweep does NOT auto-release these (a future enhancement could add a stale-lock sweeper). For now, the admin can cancel the job.
- **Handler throws repeatedly** — after `max_attempts` retries, the job is marked `failed` permanently. The admin can read `last_error` to diagnose.
- **Provider is down** — handlers throw `JobError` with `retryable: true`, the runner applies exponential backoff.
- **Provider is unconfigured** — handlers log a skipped state and return normally (no retry).
