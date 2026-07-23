# Refund Operations

This document explains how refunds are modelled, validated, and processed.

## Schema

The `refunds` table records every refund request. Key columns:

- `id` — UUID primary key.
- `order_id` — references the order (with `onDelete: 'restrict'` — orders with refunds cannot be deleted).
- `payment_id` — references the captured payment (also `restrict`).
- `provider_refund_id` — Razorpay's refund ID after the provider call.
- `amount_paise` — the refund amount in integer paise.
- `reason` — admin-provided reason (3-500 characters).
- `status` — `pending`, `processing`, `processed`, `failed`, `cancelled`.
- `requested_by` — the admin user ID.
- `requested_at`, `processed_at` — timestamps.
- `idempotency_key` — SHA-256 of `paymentId:amountPaise:actorUserId`. Unique index.
- `provider_response` — raw provider response (sanitised at the application boundary).
- `failure_reason` — captured on provider failure.

The `orders.refund_total_paise` column is recomputed after every refund mutation.

## Idempotency

Every refund request derives an idempotency key from `(paymentId, amountPaise, actorUserId)` using SHA-256. The unique index on `idempotency_key` enforces deduplication at the database level. If a refund with that key already exists:

- The existing record is returned WITHOUT re-calling the provider.
- This is true even if the existing refund is `failed` — the admin must change the amount or reason to force a new attempt.

This idempotent refund system follows the same pattern as the webhook event deduplication and checkout attempt idempotency — every mutation uses a unique key to prevent duplicate side effects. See [Payment Processing](payment-processing.md) and [Checkout Saga](checkout-saga.md) for the other idempotency mechanisms.

## Validation

`validateRefundRequest` enforces:

1. Amount must be positive.
2. Reason must be non-empty.
3. A payment record must exist for the order.
4. Payment status must be `captured` or `refunded` (partial refunds against an already-refunded payment are allowed).
5. `providerPaymentId` must be present.
6. `alreadyRefunded + amountPaise <= capturedAmount` — excess refunds are rejected with `excess_refund`.

## Razorpay call

If `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` are configured, the refund is processed immediately:

1. The refund record is inserted with `status = 'pending'`.
2. Status is updated to `'processing'`.
3. `getRazorpay().payments.refund(providerPaymentId, { amount, notes })` is called.
4. The provider response is mapped to a final status:
   - `processed` or `created` → `processed`
   - `failed` → `failed`
   - other → `processing` (the webhook will update it later)
5. `processedAt` is set if final status is `processed`.

If Razorpay is NOT configured, the refund remains in `pending` status for manual processing once credentials are activated. The admin UI clearly shows this state.

## Order status

After a successful refund:

1. `recomputeOrderRefundTotal(orderId)` updates `orders.refund_total_paise`.
2. If the refund is `pending` or `processing` and the order's current status allows it, the order transitions to `refund_pending`.
3. The order NEVER auto-transitions to `refunded` — that requires an explicit admin action via `transitionOrderStatusAction({ toStatus: 'refunded' })`.

This separation ensures that a partial refund does not mark the order as fully refunded, and that the admin reviews the final state before closing the order.

## Webhook reconciliation

Razorpay sends `refund.processed` and `refund.failed` webhooks. The webhook handler:

1. Verifies the webhook signature.
2. Finds the refund by `provider_refund_id`.
3. Updates the status from the webhook payload.

(Note: refund webhook handling is scaffolded for the owner to enable once they confirm their Razorpay webhook subscription includes refund events. The code path is safe — duplicate events are deduplicated by `rawEventId`.)

## Admin UI

The order detail page at `/admin/orders/[id]` includes a "Request refund" form:

- Amount (paise, integer)
- Reason (3-500 characters)

The form calls `requestRefundAction` which:

1. Validates the request via `validateRefundRequest`.
2. Calls `createRefund` (idempotent).
3. Calls `recomputeOrderRefundTotal`.
4. Transitions the order to `refund_pending` if applicable.
5. Records an audit entry.

The refund table on the order detail page shows all refunds for the order with their amounts, reasons, statuses, and timestamps.

## Safe unconfigured state

When Razorpay credentials are missing:

- Refund requests are still recorded in the database with `status = 'pending'`.
- The admin UI shows "Refund recorded but Razorpay is not configured — pending manual processing".
- The owner can activate Razorpay later and re-process the pending refunds via the admin UI (a "Retry" button calls the provider with the same idempotency key).

This means the admin can record a refund decision immediately without waiting for credential activation, and the actual money movement happens once Razorpay is live.

## Failure modes

- **Excess refund** — rejected at validation time with `excess_refund`.
- **Provider error** — captured in `failure_reason`, status set to `failed`, admin can retry.
- **Duplicate request** — idempotency key prevents duplicate provider calls.
- **Refund of an order with no captured payment** — rejected at validation time with `payment_not_captured`.
- **Refund of a cancelled order** — the order state machine prevents `cancelled → refund_pending`.
