# Architecture

DeviceDestination uses Next.js App Router with Server Components by default. Interactive islands are limited to the cart, product gallery, system builder and forms.

## Data flow

1. `src/data/seed-products-source.ts` is the deterministic public migration source for the 19 existing products.
2. `src/data/catalog.ts` converts old rupee amounts to integer paise, applies audited model corrections and attaches exact local documents.
3. `scripts/seed.ts` upserts public data into normalized Neon/PostgreSQL tables.
4. `src/data/repository.ts` uses Neon when `DATABASE_URL` exists and the public seed fallback only for an unconfigured preview.
5. Confidential supplier costs are never represented in the public schema or client payloads.

## Commerce

The anonymous Zustand cart persists only product IDs and quantity. `/api/orders` validates the submitted IDs against trusted catalogue data, recalculates totals, computes a server-side shipping quote via `getShippingQuote`, and reserves inventory atomically before creating the Razorpay order. A Razorpay order is created server-side, the callback signature is verified server-side, and the webhook signature is independently verified. A customer-facing success page requires a server-generated confirmation token.

## Inventory and reservations

Inventory reservations use atomic conditional UPDATEs because the neon-http driver does not support interactive row-locked transactions. The `reserveInventoryForOrder` helper increments `inventory.reserved` only if `quantityAvailable - reserved >= requested`. On failure, all previously-created reservations for that order are released and the order creation is aborted. After verified payment capture, `consumeReservationsForOrder` decrements both `reserved` and `quantityAvailable`. After failure or cancellation, `releaseReservationsForOrder` decrements only `reserved`. A cron-driven expiry sweep releases any active reservation whose `expiresAt` has passed.

## Order state machine

`src/lib/order-state.ts` is the single source of truth for order status transitions. The state machine enforces that shipment requires `processing`, delivery requires `shipped`, refunds require a paid-equivalent state, and that `delivered`, `cancelled`, and `refunded` are terminal except for explicit reconciliation paths. Every transition is recorded in `order_status_events` and in `admin_audit_logs`.

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

`src/lib/jobs.ts` provides `enqueueJob`, `claimJobs`, `completeJob`, and `failJob`. Job claiming uses an atomic conditional UPDATE so two workers cannot claim the same job. Exponential backoff is 30s × 4^attempts. After `maxAttempts` (default 5), the job is marked `failed` permanently. The cron endpoint at `/api/internal/jobs/run` requires `CRON_SECRET` and runs one batch per invocation.
