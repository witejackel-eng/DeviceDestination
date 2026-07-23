# Payment Processing

This document explains how payment capture is processed idempotently through the 11-step pipeline, how webhook events are deduplicated, and how missing-step recovery works after failures.

## Webhook idempotency

### The payment_webhook_events table

Every Razorpay webhook event is durably recorded in the `payment_webhook_events` table before any processing begins. The table has a unique index on `provider_event_id`, which is the Razorpay event identifier (from the `x-razorpay-event-id` header or composed from `eventType:paymentId`).

Key columns:

| Column | Purpose |
|---|---|
| `provider_event_id` | Razorpay event ID (unique index) |
| `event_type` | `payment.captured`, `payment.failed`, etc. |
| `provider_order_id` | Razorpay order ID |
| `provider_payment_id` | Razorpay payment ID |
| `amount_paise` | Amount from the webhook payload |
| `processing_status` | `received` → `processing` → `completed`/`failed`/`ignored` |
| `attempts` | Number of processing attempts |
| `last_error` | Error message on failure (safe — no secrets) |
| `received_at` | When the event was first received |
| `processing_started_at` | When processing was claimed |
| `completed_at` | When processing finished |

### Duplicate event handling

When a webhook event arrives, `finalizeCapturedPayment` attempts to insert a new row with `provider_event_id`. If the insert succeeds, processing begins. If a unique-key conflict occurs, the existing row is looked up:

- **`completed` or `ignored`** — the event was already fully processed. The function returns `duplicate_completed` with the existing order ID. No work is re-done.
- **`processing`** — another worker is currently processing the event. The function returns `accepted_processing`. The caller knows the event will be processed soon.
- **`received` or `failed`** — the event was received but not completed (possibly a crash or failure). The current worker atomically claims it and proceeds.

### Processing states

The `processing_status` enum flow:

1. **`received`** — event persisted, not yet claimed.
2. **`processing`** — a worker has claimed the event and is executing the pipeline.
3. **`completed`** — all 11 steps finished successfully.
4. **`ignored`** — the payment was already fully processed before this event arrived (duplicate capture after `processingCompletedAt` is set).
5. **`failed`** — a step threw an error. The event is recoverable via retry or reconciliation.

## Missing-step recovery

### How timestamps track completion

The `payments` table has timestamp columns for each processing step. Each step checks its timestamp before executing — if the timestamp is already set, the step is skipped:

| Timestamp column | Step it guards |
|---|---|
| `capture_recorded_at` | Step 5: record provider payment capture |
| `order_paid_marked_at` | Step 6: mark order as paid |
| `inventory_consumed_at` | Step 7: consume inventory reservations |
| `invoice_job_queued_at` | Step 9: enqueue invoice job |
| `email_job_queued_at` | Step 9: enqueue email job |
| `whatsapp_job_queued_at` | Step 9: enqueue WhatsApp job |
| `processing_completed_at` | Step 10: mark processing complete |

If `finalizeCapturedPayment` is called again (via webhook retry, reconciliation, or manual recovery), it checks each timestamp and resumes from the first missing step. Steps that already completed are harmlessly skipped.

### The finalizeCapturedPayment function

`finalizeCapturedPayment` in `src/lib/payment-processing.ts` is the single entry point for processing a `payment.captured` webhook. It:

1. Persists or resolves the webhook event (steps 1–4 above).
2. Atomically claims the event for processing (`received`/`failed` → `processing`).
3. Calls `processPaymentSteps` which executes steps 5–10.
4. Marks the event as `completed`, `ignored`, or `failed`.

If a claim fails (another worker got it), it returns `accepted_processing` — the caller does not need to retry.

## The 11-step processing pipeline

| Step | Action | Idempotent guard |
|---|---|---|
| 1 | Persist webhook event row | Unique index on `provider_event_id` |
| 2 | Check if event already completed | `processing_status = completed/ignored` |
| 3 | Check if event is currently processing | `processing_status = processing` |
| 4 | Atomically claim event for processing | `UPDATE WHERE status IN ('received', 'failed')` |
| 5 | Record provider payment capture | `capture_recorded_at` null check; amount match |
| 6 | Mark order as paid | `order_paid_marked_at` null check; state machine |
| 7 | Handle inventory (consume or re-reserve) | `inventory_consumed_at` null check |
| 8 | *(handled within step 7)* | — |
| 9 | Enqueue invoice, email, WhatsApp jobs | Per-job timestamp null checks + dedupe keys |
| 10 | Mark payment processing completed | `processing_completed_at` null check |
| 11 | Mark webhook event completed/ignored | Final UPDATE on `payment_webhook_events` |

### Step detail: amount verification (step 5)

Before recording the capture, the webhook amount is compared against the stored payment amount. A mismatch throws an error and the event is recorded as `failed`. This prevents a tampered or misconfigured webhook from capturing at a different price.

### Step detail: order state transition (step 6)

If the order is not already `paid` (or `inventory_exception`), `assertTransition` validates the transition and the order is updated. If the order is already `paid` (e.g. from a previous partial run), the step is skipped.

### Step detail: inventory handling (step 7)

Three scenarios:

1. **Active reservations exist** — `consumeReservationsForOrder` is called. Both `reserved` and `quantityAvailable` are decremented atomically.
2. **No active reservations (expired)** — a fresh reservation is attempted via `reserveInventoryForOrder`. If it succeeds, consumption follows. If it fails (insufficient stock after expiry), the order is set to `inventory_exception` with a `fulfilmentHoldReason`, and an admin-alert job is enqueued.
3. **Order already in `inventory_exception`** — the `inventory_consumed_at` timestamp is intentionally left null, signalling that admin intervention is needed before inventory can be consumed.

## Razorpay signature verification

The webhook route (`src/app/api/webhooks/razorpay/route.ts`) verifies the HMAC signature before trusting any payload:

```typescript
verifyRazorpayWebhookSignature(payload, signature)
```

This uses `createHmac("sha256", RAZORPAY_WEBHOOK_SECRET)` on the raw request body and compares the result against the `x-razorpay-signature` header using `timingSafeEqual` (constant-time comparison to prevent timing attacks).

If the signature is invalid, the route returns `401` immediately — no processing, no database writes, no event recording.

## Payment capture after reservation expiry

When a payment is captured but the original inventory reservations have expired (e.g. the 15-minute window passed before the payment completed), `processPaymentSteps` step 7 handles this gracefully:

1. It checks for active reservations (`pending`, `active`, `consuming`).
2. If none exist, it attempts a fresh reservation for the order's items.
3. If the fresh reservation succeeds, it consumes the reservations immediately.
4. If the fresh reservation fails (another order took the stock), the order is set to `inventory_exception` status with a descriptive `fulfilmentHoldReason` like "Insufficient stock after reservation expiry".

The `inventory_exception` status is not terminal — it signals that:
- The customer has paid.
- Stock is insufficient for fulfilment.
- An admin must resolve the situation (restock, partial shipment, or refund).

An admin-alert job (`send-order-email` with `alertType: "inventory_exception"` and a dedupe key) is enqueued so the operations team is notified.

The `inventory_consumed_at` timestamp remains null for `inventory_exception` orders, which means:
- Reconciliation's `repairIncompletePostPaymentProcessing` will detect the gap.
- If stock becomes available (e.g. after a restock adjustment), reconciliation can re-attempt the reservation and consumption.
