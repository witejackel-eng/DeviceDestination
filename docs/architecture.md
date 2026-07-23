# Architecture

DeviceDestination uses Next.js App Router with Server Components by default. Interactive islands are limited to the cart, product gallery, system builder and forms.

## Data flow

1. `src/data/seed-products-source.ts` is the deterministic public migration source for the 19 existing products.
2. `src/data/catalog.ts` converts old rupee amounts to integer paise, applies audited model corrections and attaches exact local documents.
3. `scripts/seed.ts` upserts public data into normalized Neon/PostgreSQL tables.
4. `src/data/repository.ts` uses Neon when `DATABASE_URL` exists and the public seed fallback only for an unconfigured preview.
5. Confidential supplier costs are never represented in the public schema or client payloads.

## Commerce

The anonymous Zustand cart persists only product IDs and quantity. The checkout orchestrator (`src/lib/checkout-orchestrator.ts`) validates the submitted IDs against trusted catalogue data, recalculates totals, computes a server-side shipping quote via `getShippingQuote`, and tracks the full checkout lifecycle via the `checkout_attempts` table with an idempotency key. The saga pattern compensates on failure: inventory is released, the order is cancelled, and the payment is marked failed if any step (inventory reservation, Razorpay order creation, or payment-row update) throws. A Razorpay order is created server-side, the callback signature is verified server-side, and the webhook signature is independently verified. A customer-facing success page requires a server-generated confirmation token.

## Checkout saga and idempotency

The `checkout_attempts` table implements the saga pattern for checkout. Each attempt tracks its phase (`initialized` → `local_order_created` → `inventory_reserved` → `provider_order_creating` → `ready_for_checkout` → `failed`/`cancelled`). The idempotency key ensures that the same key returns the existing order if `ready_for_checkout`, returns `processing` if still in progress, or returns a retryable error if `failed`. See [Checkout Saga](checkout-saga.md) for full documentation.

## Webhook event processing

The `payment_webhook_events` table durably records every Razorpay webhook event before processing begins. The unique index on `provider_event_id` prevents duplicate processing. Events move through `received` → `processing` → `completed`/`failed`/`ignored`. Completed events are skipped on retry. Failed events can be re-claimed and re-processed, resuming from the last completed step via timestamp guards on the `payments` table. See [Webhook Recovery](webhook-recovery.md) and [Payment Processing](payment-processing.md) for full documentation.

## Inventory and reservations

Inventory reservations use atomic conditional UPDATEs because the neon-http driver does not support interactive row-locked transactions. The `reserveInventoryForOrder` helper uses a pending→active creation pattern: it inserts the reservation row with `status = 'pending'` first, then atomically increments `inventory.reserved` only if `quantityAvailable - reserved >= requested`, then activates the reservation. On failure, all previously-created reservations for that order are compensated and the order creation is aborted. Consumption and release use atomic status claims (`active → consuming → consumed` or `active → releasing → released`) so only the claiming worker may alter inventory. A cron-driven expiry sweep releases any active reservation whose `expiresAt` has passed, and reconciles stale `pending`, `consuming`, and `releasing` reservations. See [Inventory Operations](inventory-operations.md) for full documentation.

## Order state machine

`src/lib/order-state.ts` is the single source of truth for order status transitions. The state machine enforces that shipment requires `processing`, delivery requires `shipped`, refunds require a paid-equivalent state, and that `delivered`, `cancelled`, and `refunded` are terminal except for explicit reconciliation paths. The `inventory_exception` status holds a paid order when stock is unavailable after reservation expiry — it is not terminal and requires admin resolution. Every transition is recorded in `order_status_events` and in `admin_audit_logs`.

## Refunds

`src/lib/refunds.ts` records every refund as a row in `refunds` with an idempotency key derived from the payment ID, amount and actor. Repeat requests with the same key return the existing record without re-calling the provider. Refund totals are tracked per payment and can never exceed the captured amount. The order's `refundTotalPaise` is recomputed after every refund mutation, but the order's transition to `refunded` requires an explicit admin action — it is never automatic.

## Accounts and admin

Better Auth uses the Drizzle adapter with secure cookies. Guest checkout is independent. The admin layout (`src/app/admin/layout.tsx`) requires a valid session and an email in `ADMIN_EMAILS`. Without production configuration, admin pages render but every mutation returns a clean authorization error. All admin server actions live in `src/app/admin/actions/*.ts` and route through `resolveAdmin()` for authorization, `recordAudit()` for audit logging, and Zod for input validation.

## Notifications

Enquiries use Zod, a honeypot and rate limiting. The server stores them in PostgreSQL and enqueues durable notification jobs in the `jobs` table. The cron-protected runner at `/api/internal/jobs/run` claims batches of pending jobs, dispatches each to the appropriate handler in `src/lib/job-dispatcher.ts`, and uses exponential backoff for retryable failures. Email and WhatsApp statuses are stored independently on each order so that one channel's failure never blocks the other. Production refuses a fake success when neither storage nor notification delivery is configured.

## Payment reconciliation

`src/lib/reconciliation.ts` compares local payment state against Razorpay's API. It auto-promotes orders to `paid` only when the provider confirms capture AND the amount matches AND the payment was previously verified. It NEVER auto-downgrades a paid order — `local_paid_provider_pending` requires operational review. A scheduled sweep reconciles stale pending payments older than 30 minutes.

## Settings

`src/lib/settings.ts` provides a database-backed private settings layer for non-secret operational values (free shipping threshold, reservation duration, low-stock threshold, etc.). Defaults are conservative. Secrets remain environment variables. All setting changes are audit-logged.

## Shipping

`src/lib/shipping.ts` returns a `ShippingQuote` for any pincode. Unknown pincodes default to `manual_confirmation`. COD is never enabled unless a rule explicitly sets it. The checkout blocks `unserviceable` pincodes and routes `manual_confirmation` pincodes through the normal flow (the order carries the serviceability result so operations can confirm before dispatch).

## Job runner

`src/lib/jobs.ts` provides `enqueueJob`, `enqueueDeduplicatedJob`, `claimJobs`, `completeJob`, and `failJob`. Job claiming uses an atomic conditional UPDATE so two workers cannot claim the same job. Exponential backoff is 30s × 4^attempts. After `maxAttempts` (default 5), the job is marked `failed` permanently. The cron endpoint at `/api/internal/jobs/run` requires `CRON_SECRET` and runs one batch per invocation. See [Job Runner](job-runner.md) for full documentation.

## Job deduplication

`enqueueDeduplicatedJob` uses a `dedupeKey` column on the `jobs` table with a partial unique index (`WHERE status IN ('pending', 'processing', 'completed')`). If an active job with the same `dedupeKey` exists, its ID is returned instead of creating a duplicate. This prevents duplicate invoice-generation, email, and WhatsApp jobs for the same order. Dedupe key format examples: `generate-invoice:<orderId>`, `send-order-email:<orderId>`, `send-order-whatsapp:<orderId>`, `admin-alert:inventory_exception:<orderId>`.

## System runs tracking

The `system_runs` table records each cron run with: `trigger_source` (`vercel_cron` or `manual`), `jobs_claimed`, `jobs_completed`, `jobs_failed`, `reservations_expired`, `payments_reconciled`, `duration_ms`, `started_at`, `completed_at`. This provides operational visibility into cron run frequency, duration, and effectiveness. System runs recording is best-effort — a failure to insert does not abort the cron run.

## Payment processing timestamps

The `payments` table tracks each processing step with nullable timestamp columns: `capture_recorded_at`, `order_paid_marked_at`, `inventory_consumed_at`, `invoice_job_queued_at`, `email_job_queued_at`, `whatsapp_job_queued_at`, `processing_completed_at`. A null timestamp means the step has not completed. The `finalizeCapturedPayment` function checks each timestamp before executing its step — if already set, the step is skipped. This makes each step independently idempotent and enables recovery to resume from the last completed step. See [Payment Processing](payment-processing.md) and [Backend Failure Recovery](backend-failure-recovery.md) for full documentation.

## Inventory exception status

The `inventory_exception` order status is set when a payment is captured but inventory reservations have expired and fresh reservation fails (insufficient stock). The order's `fulfilmentHoldReason` column stores a descriptive message. The `inventory_consumed_at` timestamp remains null, signalling that inventory has not been consumed. Admin intervention is required: restock, partial shipment, or refund. The `repairIncompletePostPaymentProcessing` reconciliation function re-attempts reservation for `inventory_exception` orders, so if stock is restocked, the order can proceed automatically.
