# Backend Failure Recovery

This document explains how each payment-processing step is independently idempotent, how timestamps track step completion, the failure injection system for testing, and the available recovery paths.

## Independently idempotent processing steps

Each step in the payment processing pipeline (`processPaymentSteps` in `src/lib/payment-processing.ts`) is independently idempotent. This means a retry can safely re-execute the entire pipeline — only the steps that have not yet completed will actually do work.

The mechanism is simple: before each step, the function checks whether the corresponding timestamp column on the `payments` table is already set. If it is, the step is skipped.

| Step | Timestamp guard | What it prevents |
|---|---|---|
| Record capture | `capture_recorded_at` | Double-writing the `captured` status |
| Mark order paid | `order_paid_marked_at` | Double-transitioning the order to `paid` |
| Consume inventory | `inventory_consumed_at` | Double-decrementing `reserved` and `quantityAvailable` |
| Enqueue invoice job | `invoice_job_queued_at` | Double-creating an invoice-generation job |
| Enqueue email job | `email_job_queued_at` | Double-creating a send-order-email job |
| Enqueue WhatsApp job | `whatsapp_job_queued_at` | Double-creating a send-order-whatsapp job |
| Mark processing complete | `processing_completed_at` | Double-marking the payment as fully processed |

### Example: recovery after a mid-pipeline crash

Suppose a serverless function crashes after completing steps 5 and 6 but before step 7 (inventory consumption). On recovery:

1. The webhook event is in `failed` status.
2. A retry call to `finalizeCapturedPayment` claims the event (`failed` → `processing`).
3. `processPaymentSteps` finds `capture_recorded_at` is set → skips step 5.
4. `processPaymentSteps` finds `order_paid_marked_at` is set → skips step 6.
5. `processPaymentSteps` finds `inventory_consumed_at` is null → executes step 7.
6. Continues through steps 9, 10, and marks the event `completed`.

No duplicate work. No double captures. No double inventory decrements.

## Timestamps on payments record

The `payments` table (extended by migration `drizzle/0002_large_toad_men.sql`) includes these processing-tracking timestamp columns:

| Column | Type | Purpose |
|---|---|---|
| `capture_recorded_at` | `timestamp with time zone` | When the `captured` status and `providerPaymentId` were written |
| `order_paid_marked_at` | `timestamp with time zone` | When the order was transitioned to `paid` |
| `inventory_consumed_at` | `timestamp with time zone` | When inventory reservations were consumed (null for `inventory_exception` orders) |
| `invoice_job_queued_at` | `timestamp with time zone` | When the `generate-invoice` job was enqueued |
| `email_job_queued_at` | `timestamp with time zone` | When the `send-order-email` job was enqueued |
| `whatsapp_job_queued_at` | `timestamp with time zone` | When the `send-order-whatsapp` job was enqueued |
| `processing_completed_at` | `timestamp with time zone` | When all processing steps finished |

All timestamps are nullable. A `null` value means the step has not been completed. The reconciliation system (`repairIncompletePostPaymentProcessing`) explicitly checks for `null` timestamps on `paid`/`inventory_exception` orders and fills in missing steps.

## Failure injection system

### Test-only, dependency-injected

The failure injection system (`tests/helpers/failure-injection.ts`) provides controlled failure simulation for integration tests. It is **never accessible in production**:

- `assertTestEnvironment()` throws if `NODE_ENV !== "test"`.
- No production API route, request parameter, or environment variable can activate it.
- It uses dependency injection (passing wrapped functions as parameters) or vitest mocks, not global state that could leak into production.

### 7 failure points

| Failure point | Step it simulates | What it tests |
|---|---|---|
| `reservation_insertion` | Reservation row INSERT fails after `reserved` counter is incremented | Compensation decrements `reserved` back |
| `reservation_activation` | `pending → active` UPDATE fails after increment | Compensation decrements `reserved` and marks reservation `failed` |
| `payment_update` | Payment status/capture UPDATE fails | Idempotent retry on next attempt |
| `inventory_consumption` | `consumeReservationsForOrder` throws | Reconciliation detects null `inventory_consumed_at` and retries |
| `job_enqueue` | `enqueueDeduplicatedJob` throws | Reconciliation detects null job timestamps and re-enqueues |
| `razorpay_order_creation` | `getRazorpay().orders.create()` throws | Checkout compensation releases inventory and cancels order |
| `payment_reconciliation` | Razorpay API fetch fails during reconciliation | Reconciliation records `provider_error` and retries on next cron |

### How it works

The failure injection module provides:
- `createFailableFunction(injection, point, originalFn)` — wraps a function so it throws if the injection matches the point.
- Named convenience wrappers: `failReservationInsertion`, `failReservationActivation`, `failPaymentUpdate`, `failInventoryConsumption`, `failJobEnqueue`, `failRazorpayOrderCreation`, `failPaymentReconciliation`.
- `createMockWithInjection` — for vitest `vi.fn()` patterns.
- `setTestFailureFlag(point)` / `clearTestFailureFlag()` — module-level test-only flag for vi.mock patterns.
- `NO_FAILURE` — a null injection constant meaning no failures are injected.

Integration tests use these to verify that each failure scenario is recoverable without data corruption.

## Recovery paths

### Webhook retry

Razorpay retries webhook delivery for HTTP responses that are not 200. However, our webhook handler returns 200 for most outcomes (including `failed` processing), so Razorpay retry is primarily useful for:
- Network-level failures (the request never reached our server).
- 401 responses (invalid signature — Razorpay will not retry these).

For in-processing failures, Razorpay retries will not help because we already returned 200. Recovery must come from reconciliation.

### Reconciliation

The cron-protected job runner (`/api/internal/jobs/run`) calls three recovery functions on every run:

1. **`reconcileStalePendingPayments(30)`** — finds orders older than 30 minutes in `pending`/`payment_pending` status and reconciles each against Razorpay's API. Promotes `local_pending_provider_captured` orders to `paid`.

2. **`repairIncompletePostPaymentProcessing(50)`** — checks up to 50 `paid`/`inventory_exception` orders for gaps in their processing timestamps and fills in missing steps:
   - Payment not captured locally → reconcile against provider.
   - Order not marked paid → mark paid.
   - Inventory not consumed → attempt reservation + consumption.
   - Invoice job missing → enqueue deduplicated job.
   - Email job missing → enqueue deduplicated job.
   - WhatsApp job missing → enqueue deduplicated job.

3. **`expirePendingReservations()`** — releases expired inventory reservations and marks associated unpaid orders as `cancelled`.

### Admin intervention

If automated recovery cannot resolve a situation (e.g. an `inventory_exception` order where stock is genuinely unavailable), the admin can:

1. View the order in `/admin/orders/[id]` with full payment, reservation, and status timeline.
2. Manually restock inventory via `/admin/inventory`.
3. Trigger manual reconciliation via `/api/admin/reconcile`.
4. Process a refund via the admin refund form.
5. Transition the order status manually via the admin order actions.

## Inventory exception handling

When a payment is captured but inventory reservations have expired and fresh reservation fails (insufficient stock), the order is set to `inventory_exception`:

1. `processPaymentSteps` step 7 detects no active reservations.
2. It attempts `reserveInventoryForOrder` for the order's items.
3. If reservation fails, the order is updated: `status = 'inventory_exception'`, `fulfilmentHoldReason = 'Insufficient stock after reservation expiry: ...'`.
4. An admin-alert job is enqueued with dedupe key `admin-alert:inventory_exception:<orderId>`.
5. `inventory_consumed_at` is intentionally left null — signalling that inventory has not been consumed.
6. `processing_completed_at` is **still set** — the processing pipeline completed its work (it successfully identified the inventory problem and recorded it durably).

The `repairIncompletePostPaymentProcessing` function checks for `inventory_exception` orders with null `inventory_consumed_at` and attempts fresh reservation + consumption. If stock has been restocked since the original failure, this repair will succeed and the order can proceed to fulfilment.
