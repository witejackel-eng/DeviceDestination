# Webhook Recovery

This document explains how Razorpay webhook events are durably recorded, processed, and recovered after failures. It covers the processing status flow, duplicate handling, stuck-event reclaim, and how reconciliation serves as a backup recovery path.

## Durable event recording

Every Razorpay webhook event is written to the `payment_webhook_events` table **before** any business logic is executed. This is a critical design choice: no processing happens without first persisting a durable record.

The unique index on `provider_event_id` guarantees that each Razorpay event is recorded exactly once. If the same event ID is seen again, the insert fails with a unique-key conflict and the existing row is consulted instead.

This means:
- If the server crashes after recording the event but before completing processing, the event row survives. Recovery mechanisms can find and re-process it.
- If Razorpay retries delivery (it does, up to 48 hours for failed HTTP responses), the duplicate is harmlessly deduplicated.
- No webhook payload data is lost — even failures are durably recorded with their error state.

## Processing status flow

A webhook event moves through these statuses:

```
received → processing → completed
                      → failed     (recoverable — can be re-claimed)
                      → ignored    (duplicate after full processing)
```

### received

The event has been persisted but no worker has claimed it yet. This is the initial state after the `INSERT` into `payment_webhook_events`.

### processing

A worker has atomically claimed the event by executing:

```sql
UPDATE payment_webhook_events
SET processing_status = 'processing',
    processing_started_at = now(),
    attempts = attempts + 1,
    updated_at = now()
WHERE id = $1
  AND processing_status IN ('received', 'failed')
RETURNING id;
```

Only one worker can successfully claim an event. If another worker already transitioned it to `processing`, the `RETURNING` set is empty and the current worker returns `accepted_processing` without doing any work.

### completed

All 11 processing steps finished successfully. The `completed_at` timestamp is set. Any future delivery of the same `provider_event_id` will look up this row, see `completed`, and return `duplicate_completed` without re-processing.

### failed

A processing step threw an error. The event row stores:
- `last_error` — the error message (truncated to 500 characters, no secrets).
- `attempts` — incremented from the claim operation.

A `failed` event is **recoverable**. When the same `provider_event_id` arrives again (via Razorpay retry, reconciliation, or manual admin trigger), the claim query includes `'failed'` in its `WHERE` clause, so the event can be re-claimed and processing resumes from the last completed step.

### ignored

The payment was already fully processed before this event arrived. This happens when:
- A second `payment.captured` webhook is delivered for an order whose `processingCompletedAt` is already set on the `payments` table.
- The `processPaymentSteps` function detects `processingCompletedAt` and returns `{ kind: "ignored" }`.

The webhook event is marked `ignored` and `completed_at` is set. This is semantically equivalent to `completed` for deduplication purposes.

## Duplicate event handling

### Completed events skip entirely

When `finalizeCapturedPayment` sees an event with `processing_status = 'completed'` or `'ignored'`:

1. It looks up the payment/order to return useful context.
2. It returns `{ status: "duplicate_completed", orderId }`.
3. No business logic is executed. No timestamps are written. No jobs are enqueued.

### Incomplete events resume

When an event is in `received`, `processing`, or `failed`:

- **`received`** — the current worker claims it and processes it from scratch.
- **`processing`** — another worker is handling it. Return `accepted_processing`.
- **`failed`** — the current worker claims it (the claim SQL includes `'failed'`) and re-processes it. Because each processing step checks its timestamp on the `payments` table, only the **missing steps** are executed. Already-completed steps are harmlessly skipped.

### Concurrent claim race

Two workers may both read the same `received` event and attempt to claim it. The atomic `UPDATE ... RETURNING` ensures only one succeeds. The losing worker gets an empty `RETURNING` set and returns `accepted_processing`.

## Stuck event reclaim mechanism

### How events get stuck

An event in `processing` status can become stuck if:
- The serverless function timed out during processing.
- The Neon HTTP connection was interrupted mid-step.
- A deployment restart killed the function mid-execution.

The event row remains in `processing` with `processing_started_at` set, but no worker is actively processing it.

### Reclaim via Razorpay retry

Razorpay retries webhook delivery for events that received a non-200 HTTP response, up to 48 hours. However, our webhook handler returns 200 even for `failed` processing results (the error is durably recorded). This means Razorpay will **not** retry `failed` events automatically — recovery must come from other paths.

### Reclaim via reconciliation

The `reconcileStalePendingPayments` function in `src/lib/reconciliation.ts` is called by each cron run. It finds orders in `pending`/`payment_pending` status older than 30 minutes and reconciles each against Razorpay's API.

For stuck `processing` events, the `repairIncompletePostPaymentProcessing` function (also called by each cron run) checks for:
- Payments that are `captured` on the provider but not locally → promotes them.
- Orders that are locally captured but not marked `paid` → marks them paid.
- Orders that are `paid` but have null `inventory_consumed_at` → attempts inventory consumption.
- Orders that are `paid` but have null notification job timestamps → enqueues the missing jobs.

Each repair step uses the same timestamp-gated idempotency as `finalizeCapturedPayment`, so repairs are safe even if the original webhook is concurrently being re-processed.

### Manual admin intervention

If automated recovery doesn't resolve a stuck event, the admin can:
1. View the event in the admin audit page (`/admin/audit`) with its `processing_status`, `attempts`, and `last_error`.
2. Trigger manual reconciliation via `/api/admin/reconcile`.
3. Manually update the event status if needed (direct database intervention).

## Reconciliation as backup recovery

Reconciliation (`src/lib/reconciliation.ts`) serves as the **backup recovery path** when webhook processing fails or events are stuck. It operates by comparing local state against Razorpay's API:

| Outcome | Meaning | Action |
|---|---|---|
| `match` | Local and provider agree | No action needed |
| `local_pending_provider_captured` | Provider says captured but local is pending | Auto-promote to `paid` if amount matches |
| `local_paid_provider_pending` | Local says captured but provider disagrees | Record but **never auto-downgrade** — requires operational review |
| `amount_mismatch` | Provider amount differs | Record but never auto-downgrade |
| `provider_error` | API call failed | Record error, retry on next cron |
| `duplicate_event` | Already reconciled | No action |

The `repairIncompletePostPaymentProcessing` function extends reconciliation by checking for gaps in the processing timestamps on the `payments` table. It fills in missing steps (inventory consumption, job enqueue) for orders that are `paid` or `inventory_exception` but have incomplete processing records.

Both functions are called on every cron run (`/api/internal/jobs/run`), ensuring that any webhook processing gaps are detected and repaired within the cron cycle (currently daily via Vercel Cron, or more frequently via an external scheduler).
