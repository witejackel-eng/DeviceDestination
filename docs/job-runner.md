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

Indexes:

- `(status, run_after)` — for the claim query.
- `(type)` — for per-type admin views.
- `(locked_by)` — for stale-lock detection.

## Enqueue

`enqueueJob({ type, payload, runAfter?, maxAttempts? })` inserts a row with `status = 'pending'`. Returns the job ID. Idempotency is the caller's responsibility — for example, the webhook handler enqueues `generate-invoice` only if the order's `invoiceNumber` is null.

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
6. Returns a summary of the run.

`vercel.json` configures Vercel Cron to hit this endpoint every 5 minutes.

## Admin UI

Visit `/admin/audit?tab=jobs` to see the most recent 100 jobs with their type, status, attempts, run-after, last error, and creation time.

Visit `/api/admin/jobs/[id]/cancel` (POST, admin-authorized) to cancel a stuck job.

## Failure modes

- **Two workers claim the same job** — prevented by the atomic conditional UPDATE.
- **Worker dies mid-job** — the job remains in `processing` with `locked_at` set. The cron sweep does NOT auto-release these (a future enhancement could add a stale-lock sweeper). For now, the admin can cancel the job.
- **Handler throws repeatedly** — after `max_attempts` retries, the job is marked `failed` permanently. The admin can read `last_error` to diagnose.
- **Provider is down** — handlers throw `JobError` with `retryable: true`, the runner applies exponential backoff.
- **Provider is unconfigured** — handlers log a skipped state and return normally (no retry).
