# Backend Activation Checklist

This checklist divides backend activation into three categories. Do not mix them — items in **A** are already implemented in code, items in **B** require the owner to act in external dashboards, and items in **C** require the owner to make business policy decisions.

---

## A. Completed in code by Z-AI

These items are implemented, type-checked, unit-tested, and built successfully. They become live the moment the owner provides the corresponding environment variables and runs the database migration.

### Database and schema

- [x] Drizzle schema extended with: `product_price_history`, `inventory_reservations`, `inventory_adjustments`, `jobs`, `quotes`, `quote_items`, `quote_status_history`, `shipping_zones`, `shipping_pincode_rules`, `refunds`, `payment_reconciliation_results`, `order_status_events`, `settings`, `payment_webhook_events`, `checkout_attempts`, `system_runs`.
- [x] Forward-only migration `drizzle/0001_ancient_sabretooth.sql` generated.
- [x] Forward-only migration `drizzle/0002_large_toad_men.sql` generated (webhook events, checkout attempts, system runs, reservation status expansion, payment processing timestamps, job deduplication, inventory exception status).
- [x] Indexes added for: orders by status and created date, payments by provider IDs, inventory reservations by status and expiry, jobs by status and run-after, enquiries by status and created date, quotes by status and expiry, audit logs by entity and timestamp, product-price history by product and timestamp.
- [x] `order_status` enum extended with `refund_pending` and `inventory_exception`.
- [x] `reservation_status` enum extended with `pending`, `consuming`, `releasing`, `failed`.
- [x] `webhook_event_processing_status` enum created (`received`, `processing`, `completed`, `failed`, `ignored`).
- [x] `checkout_attempt_status` enum created (`initialized`, `local_order_created`, `inventory_reserved`, `provider_order_creating`, `provider_order_created`, `payment_recorded`, `ready_for_checkout`, `failed`, `cancelled`).
- [x] `enquiry_status`, `quote_status`, `job_status`, `refund_status`, `reservation_status`, `price_source_status`, `shipping_serviceability`, `reconciliation_outcome`, `inventory_adjustment_type` enums created.

### Admin operations

- [x] `/admin` operations dashboard with real counts (pending payments, paid awaiting processing, low stock, expiring reservations, stale prices, failed notifications, new enquiries, pending jobs, recent audit events).
- [x] `/admin/products` — list with search, filter by publication status, stock status, price source, stale-price toggle; paginated.
- [x] `/admin/products/new` — create draft product.
- [x] `/admin/products/[id]` — edit product, manage price (with immutable history), manage publication status, manage stock status, view images/documents/specs/highlights/price history.
- [x] `/admin/orders` — list with filters (status, notification failures).
- [x] `/admin/orders/[id]` — detail with items, payments, refunds, reservations, status timeline; actions for processing, shipment (with courier + tracking), delivery, cancellation, refund request, internal notes, notification retries (email/WhatsApp/invoice).
- [x] `/admin/pricing` — pricing dashboard with stale-price filter.
- [x] `/admin/inventory` — stock view, reservations view, immutable adjustment history, new adjustment form (receipt/correction/damage/return/reservation_correction/release).
- [x] `/admin/enquiries` — list with status filter and search.
- [x] `/admin/enquiries/[id]` — detail with assignment, follow-up scheduling, internal notes, status transitions, notification retry.
- [x] `/admin/quotes` — list and create quote form.
- [x] `/admin/quotes/[id]` — detail with lifecycle transitions (draft → sent → accepted → converted).
- [x] `/admin/audit` — audit log with filters, plus background jobs view.
- [x] `/admin/settings` — operational settings editor with validators.
- [x] `/admin/settings/shipping` — shipping zones and pincode rules editor.

### Backend services

- [x] Order state machine (`src/lib/order-state.ts`) — single source of truth for transitions.
- [x] Inventory reservation service (`src/lib/inventory.ts`) — atomic, no oversell, no negative stock, idempotent consume/release.
- [x] Shipping engine (`src/lib/shipping.ts`) — `getShippingQuote`, conservative defaults, manual-confirmation fallback.
- [x] Refund foundation (`src/lib/refunds.ts`) — idempotent, never exceeds captured amount, safe unconfigured state.
- [x] Durable job runner (`src/lib/jobs.ts`) + dispatcher (`src/lib/job-dispatcher.ts`) — atomic claim, exponential backoff, max-attempts, job deduplication via `dedupeKey`.
- [x] Checkout orchestrator (`src/lib/checkout-orchestrator.ts`) — saga pattern with idempotency keys, compensation on failure, placeholder payment before Razorpay call.
- [x] Payment processing (`src/lib/payment-processing.ts`) — 11-step idempotent pipeline, webhook event deduplication, missing-step recovery via timestamps.
- [x] System runs tracking — `system_runs` table records each cron run for operational visibility.
- [x] Payment reconciliation (`src/lib/reconciliation.ts`) — provider comparison, safe auto-promote, never auto-downgrade.
- [x] Settings layer (`src/lib/settings.ts`) — typed validators, conservative defaults.
- [x] Customer account backend (`src/lib/account.ts`) — order history, addresses, profile, guest-order linking.
- [x] Audit helper (`src/lib/audit.ts`) — never throws, redacts secrets.
- [x] Typed environment validator (`src/lib/env.ts`) — grouped errors, channel-specific helpers.
- [x] File validation and Blob upload adapter (`src/lib/blob.ts`) — MIME + signature check, deterministic filenames, unconfigured-safe.

### API routes

- [x] `GET /api/health` — minimal status.
- [x] `GET /api/readiness` — grouped channel statuses (ready/degraded/unconfigured), no secrets exposed.
- [x] `POST /api/internal/jobs/run` — cron-protected job runner (also handles `GET` for Vercel Cron).
- [x] `POST /api/checkout/serviceability` — server-side pincode check.
- [x] `POST /api/admin/refunds` — refund request endpoint (admin-authorized).
- [x] `POST /api/admin/reconcile` — manual reconciliation trigger.
- [x] `POST /api/admin/jobs/[id]/cancel` — cancel a stuck job.
- [x] `GET/POST /api/account/addresses` — list/create saved addresses.
- [x] `PATCH/DELETE /api/account/addresses/[id]` — update/delete saved addresses.
- [x] `POST /api/account/orders/[orderNumber]/claim` — claim guest orders by verified email.
- [x] `PATCH/POST /api/account/profile` — profile update, data export/deletion requests.

### Checkout integration

- [x] Checkout orchestration (`orchestrateCheckout`) now: validates pincode server-side, computes shipping, stores serviceability result on order, reserves inventory atomically before Razorpay order creation, compensates on failure via saga pattern, uses `checkout_attempts` table for idempotency.
- [x] Razorpay webhook now: verifies signature before processing, records events durably in `payment_webhook_events`, delegates to `finalizeCapturedPayment` for 11-step idempotent processing, consumes reservations on capture, releases on failure, enqueues deduplicated invoice-generation and notification jobs.
- [x] Razorpay order creation failure releases reservations and cancels the pending order.

### CI and config

- [x] `.github/workflows/ci.yml` — lint, typecheck, unit tests, products validation, theme validation, build, migration consistency check, npm audit summary. Refuses committed `.env` files. Scans for obvious secret patterns. E2E job runs Playwright.
- [x] `vercel.json` — Vercel Cron triggers `/api/internal/jobs/run` daily at 02:00 UTC. For production-grade 15-minute reservation expiry, an external scheduler must hit this endpoint every 5–10 minutes.

### Tests added

- [x] `tests/unit/order-state.test.ts` — 22 tests covering all valid and invalid transitions.
- [x] `tests/unit/env.test.ts` — 12 tests covering environment validation and channel helpers.
- [x] `tests/unit/shipping.test.ts` — 5 tests covering no-database and invalid-pincode paths.
- [x] `tests/unit/blob.test.ts` — 10 tests covering file signature validation and filename generation.
- [x] `tests/unit/refunds.test.ts` — 5 tests covering refund idempotency.
- [x] `tests/unit/settings.test.ts` — 11 tests covering defaults and validators.
- [x] `tests/unit/audit.test.ts` — 3 tests covering redaction and safe failure.
- [x] `tests/unit/jobs.test.ts` — 3 tests covering required job types.
- [x] `tests/integration/inventory.test.ts` — 12 tests covering reservation, consumption, release, concurrency, expiry, and compensation.
- [x] `tests/integration/webhook.test.ts` — 11 tests covering webhook deduplication, idempotent processing, amount mismatch, inventory exception.
- [x] `tests/integration/checkout.test.ts` — 8 tests covering idempotency, compensation, price overrides.
- [x] `tests/integration/auth.test.ts` — 6 tests covering authorization, access control.
- [x] `tests/integration/migration.test.ts` — 4 tests covering migration consistency, indexes, enums.
- [x] `tests/helpers/failure-injection.ts` — 7 failure points for dependency-injected test-only failure simulation.
- [x] `tests/helpers/setup.ts` — integration test helpers with seed functions, cleanup, and environment configuration.

### Documentation

- [x] `docs/architecture.md` updated (added webhook events, checkout saga, system runs, job deduplication, payment timestamps, inventory exception).
- [x] `docs/payment-processing.md` — 11-step pipeline, webhook idempotency, missing-step recovery.
- [x] `docs/webhook-recovery.md` — event recording, status flow, duplicate handling, stuck event reclaim, reconciliation.
- [x] `docs/checkout-saga.md` — checkout phases, idempotency key behavior, compensation on failure, placeholder payment.
- [x] `docs/backend-failure-recovery.md` — idempotent steps, timestamps, failure injection, recovery paths, inventory exception.
- [x] `docs/ci-integration-tests.md` — CI workflow, PostgreSQL service container, synthetic secrets, test categories.
- [x] `docs/inventory-operations.md` updated (pending→active flow, atomic status claims, compensation, opportunistic cleanup, reconciliation).
- [x] `docs/job-runner.md` updated (deduplication, system runs, cron schedule change).
- [x] `docs/security.md` updated (webhook verification, event recording, no secret logging, failure injection safety).
- [x] `docs/refund-operations.md` updated (idempotency references).
- [x] `docs/backend-activation-checklist.md` (this file).
- [x] `docs/shipping-configuration.md`.
- [x] `docs/account-operations.md`.

---

## B. Must be completed by the owner in external dashboards

These items require the owner to log into external service dashboards (Neon, Razorpay, Resend, Meta Business, Upstash, Vercel Blob, Vercel). Z-AI cannot and must not perform these steps.

### Database

- [ ] Create the Neon PostgreSQL project (or point `DATABASE_URL` at an existing one).
- [ ] Run `npm run db:migrate` against production to apply `drizzle/0001_ancient_sabretooth.sql` and `drizzle/0002_large_toad_men.sql`.
- [ ] Verify the `payment_webhook_events` table exists and has the unique index on `provider_event_id`.
- [ ] Verify the `checkout_attempts` table exists and has the unique index on `idempotency_key`.
- [ ] Verify the `system_runs` table exists.
- [ ] Verify the `jobs` table has the `dedupe_key` column and partial unique index.
- [ ] Run `npm run db:seed` to populate the catalogue if not already done.
- [ ] Seed default shipping zones: `npm run db:seed -- --shipping` (after migration). Or use the admin UI at `/admin/settings/shipping`.

### Authentication

- [ ] Generate a strong `BETTER_AUTH_SECRET` (at least 32 characters).
- [ ] Set `BETTER_AUTH_URL` to the production URL (e.g. `https://device-destination-rose.vercel.app`).
- [ ] Set `ADMIN_EMAILS` to a comma-separated list of normalized admin emails.
- [ ] Verify the admin email in Better Auth (sign up + email verification flow).

### Payments (Razorpay)

- [ ] Create or confirm the Razorpay account.
- [ ] Generate `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` (server-side keys).
- [ ] Set `NEXT_PUBLIC_RAZORPAY_KEY_ID` to the public key id.
- [ ] Configure the Razorpay webhook endpoint to `https://device-destination-rose.vercel.app/api/webhooks/razorpay`.
- [ ] Copy the webhook secret into `RAZORPAY_WEBHOOK_SECRET`.
- [ ] Confirm Razorpay settlement details (Z-AI must not change these).

### Email (Resend)

- [ ] Create the Resend account.
- [ ] Verify the sending domain.
- [ ] Generate `RESEND_API_KEY`.
- [ ] Set `EMAIL_FROM` to a verified sender address.
- [ ] Set `SALES_EMAIL` to the sales team inbox.

### WhatsApp (Meta Business)

- [ ] Create the Meta Business account.
- [ ] Submit and approve WhatsApp templates: `WHATSAPP_TEMPLATE_NAME` (enquiry) and `WHATSAPP_ORDER_TEMPLATE_NAME` (order confirmation).
- [ ] Generate a permanent system-user token → `WHATSAPP_ACCESS_TOKEN`.
- [ ] Copy the phone number ID → `WHATSAPP_PHONE_NUMBER_ID`.
- [ ] Set `SALES_WHATSAPP_NUMBER` to the sales WhatsApp number.
- [ ] Set `WHATSAPP_GRAPH_VERSION` (e.g. `v23.0`).

### Rate limiting (Upstash)

- [ ] Create the Upstash Redis database.
- [ ] Copy `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.

### Uploads (Vercel Blob)

- [ ] Enable Vercel Blob on the project.
- [ ] Copy `BLOB_READ_WRITE_TOKEN`.

### Jobs (Vercel Cron)

- [ ] Generate a strong `CRON_SECRET`.
- [ ] Confirm the `vercel.json` cron entry is active in the Vercel dashboard.
- [ ] **Required for production**: Set up an external scheduler (e.g. cron-job.org, EasyCron, or a self-hosted cron daemon) to hit `https://device-destination-rose.vercel.app/api/internal/jobs/run` every 5–10 minutes with `Authorization: Bearer <CRON_SECRET>`. Vercel Cron now runs daily, which is insufficient for 15-minute reservation expiry. Without an external scheduler, reservations will not expire promptly and inventory_exception orders will not be repaired quickly.
- [ ] Verify the external scheduler is working by checking `system_runs` table for entries with `trigger_source = 'manual'`.

### Deployment

- [ ] Merge `fix/backend-reliability-hardening` into `main` after CI passes (this replaces the previous `backend/production-operations` branch).
- [ ] Verify webhook event recording works by sending a test webhook from the Razorpay dashboard and checking `payment_webhook_events` in the database.
- [ ] Verify payment processing timestamps are populated by completing a test payment and checking `payments.capture_recorded_at`, `order_paid_marked_at`, `inventory_consumed_at`, `processing_completed_at`.
- [ ] Verify inventory exception handling by testing a scenario where a payment is captured after reservation expiry and checking that the order enters `inventory_exception` status with a descriptive `fulfilment_hold_reason`.
- [ ] Push `main` to trigger Vercel deployment.
- [ ] Confirm the deployment succeeds at `https://device-destination-rose.vercel.app`.
- [ ] Visit `/api/readiness` to confirm all configured channels report `ready`.

---

## C. Must be decided by the business owner

These are policy decisions Z-AI must not make. The codebase surfaces them as configurable settings — the owner must decide and set them.

### Pricing policy

- [ ] Confirm GST rates per product category (currently 1800 basis points = 18% as default).
- [ ] Confirm MRP evidence per product before publishing `mrp_incl_gst_paise`.
- [ ] Confirm `compare_at_price_incl_gst_paise` evidence (MRP, typical online price, or regular price).

### Inventory policy

- [ ] Confirm `default_reservation_minutes` (currently 15).
- [ ] Confirm `low_stock_threshold` (currently 3).
- [ ] Decide whether stock-status transitions (`in_stock` → `limited` → `lead_time` → `quote_only`) are manual or automated.

### Shipping policy

- [ ] Confirm `free_shipping_threshold_paise` (currently 0 = disabled).
- [ ] Confirm Delhi NCR delivery fee per zone (currently 0 paise).
- [ ] Decide whether pan-India serviceability is offered (default: no — manual confirmation only).
- [ ] Confirm remote-area surcharge per zone (currently 0).
- [ ] Decide COD availability (default: no — must be explicitly enabled per rule).
- [ ] Confirm delivery estimates per zone (currently 2-5 business days for Delhi NCR).

### Quote policy

- [ ] Confirm `quote_validity_days` (currently 7).
- [ ] Decide installation-service workflow (currently modelled as `installationPaise` on quotes).

### Order policy

- [ ] Confirm `cancellation_window_hours` (currently 24).
- [ ] Decide partial-refund policy (the code supports it; the owner decides when to use it).
- [ ] Decide courier selection per zone (currently manual entry).

### Refund policy

- [ ] Confirm the published refund policy at `/refund-policy` matches operational practice.
- [ ] Decide whether refunds are full or partial by default.
- [ ] Decide the SLA for refund processing.

### Account policy

- [ ] Decide the data-export SLA (currently the request is recorded; owner fulfils within 72 hours).
- [ ] Decide the account-deletion verification flow (currently the request is recorded; owner contacts the customer to confirm).
- [ ] Confirm `max_addresses_per_user` (currently 10).

---

## Functionality intentionally left inactive until credentials are configured

The following features are fully implemented but will remain in a safe unconfigured state until the corresponding environment variables are set. They will not produce fake successes.

- Razorpay live payments (requires `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`).
- Razorpay webhook verification (requires `RAZORPAY_WEBHOOK_SECRET`).
- Razorpay refunds (requires `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`; otherwise refunds are recorded as `pending`).
- Resend transactional email (requires `RESEND_API_KEY` and `EMAIL_FROM`).
- WhatsApp Cloud API notifications (requires `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_TEMPLATE_NAME`, `SALES_WHATSAPP_NUMBER`).
- Vercel Blob uploads (requires `BLOB_READ_WRITE_TOKEN`; existing local asset paths remain readable).
- Upstash distributed rate limiting (requires `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`; in-memory fallback remains testable).
- Cron-protected job runner (requires `CRON_SECRET`; the endpoint refuses to run without it).
