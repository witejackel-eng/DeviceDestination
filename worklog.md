---
Task ID: final
Agent: main
Task: Create comprehensive documentation for backend reliability hardening on the `fix/backend-reliability-hardening` branch.

Starting commit: a9e93eaf1e3172206cbc9bf2da3b57efeca799fa
Backup branch: backup/pre-backend-reliability-repair
Implementation branch: fix/backend-reliability-hardening

## Files changed (major changes)

### New documentation files created
- `docs/payment-processing.md` — 11-step pipeline, webhook idempotency, missing-step recovery, Razorpay signature verification, inventory exception handling
- `docs/webhook-recovery.md` — durable event recording, processing status flow, duplicate handling, stuck event reclaim, reconciliation as backup recovery
- `docs/checkout-saga.md` — checkout-attempt phases, idempotency key behavior, compensation on failure, placeholder payment, cleanup
- `docs/backend-failure-recovery.md` — independently idempotent processing steps, payment timestamps, failure injection system (7 points), recovery paths, inventory exception handling
- `docs/ci-integration-tests.md` — CI workflow structure, PostgreSQL service container, synthetic CI secrets, integration test categories, local setup, test helpers

### Updated documentation files
- `docs/inventory-operations.md` — added reservation status flow (pending→active→consuming→consumed/releasing→released/expired/failed), atomic status claims, insert-first-then-increment pattern, compensation on failure, concurrent reservation protection, opportunistic cleanup, reconciliation of stale reservations
- `docs/architecture.md` — added sections for payment_webhook_events, checkout_attempts (saga pattern), system_runs, job deduplication, payment processing timestamps, inventory_exception status
- `docs/job-runner.md` — added dedupeKey column and enqueueDeduplicatedJob documentation, system_runs table, dedupe key format examples, cron schedule change (daily), repairIncompletePostPaymentProcessing call
- `docs/security.md` — added webhook signature verification before trusting payload, durable event recording, no secret logging, no provider payload dumping, rate limiting on admin endpoints, test-only failure injection safety
- `docs/refund-operations.md` — added references to idempotent refund system and cross-links to payment-processing and checkout-saga docs
- `docs/backend-activation-checklist.md` — added steps for 0002 migration, external scheduler requirement, webhook event verification, payment timestamp verification, inventory exception verification
- `README.md` — added backend reliability improvements section, cron schedule change, external scheduler requirement, detailed documentation directory listing

## Migrations created
- `drizzle/0002_large_toad_men.sql` — creates `payment_webhook_events`, `checkout_attempts`, `system_runs` tables; extends `reservation_status` with pending/consuming/releasing/failed; extends `order_status` with inventory_exception; adds payment processing timestamps to `payments`; adds `dedupe_key` to `jobs`; adds `fulfilment_hold_reason` to `orders`

## Summary of all changes

This documentation task created 5 new documentation files and updated 7 existing files to comprehensively document the backend reliability hardening improvements on the `fix/backend-reliability-hardening` branch. All documentation covers:

1. **Payment processing** — the 11-step idempotent pipeline in `finalizeCapturedPayment`, how timestamps on the `payments` table enable missing-step recovery, webhook event deduplication via `payment_webhook_events`, and Razorpay signature verification.

2. **Webhook recovery** — how events are durably recorded before processing, the processing status flow (received→processing→completed/failed/ignored), duplicate event handling, stuck event reclaim, and how reconciliation serves as backup recovery.

3. **Checkout saga** — the `checkout_attempts` table and saga pattern with phases from `initialized` through `ready_for_checkout`, idempotency key behavior, compensation on failure, and placeholder payment before Razorpay call.

4. **Backend failure recovery** — independently idempotent processing steps guarded by timestamps, the failure injection system with 7 test-only points, and recovery paths via webhook retry, reconciliation, and admin intervention.

5. **CI integration tests** — the CI workflow with PostgreSQL service containers, synthetic secrets, integration test categories (inventory, webhook, checkout, auth, migration), and local setup instructions.

6. **Inventory operations** — the updated reservation status flow with atomic claims, pending→active creation pattern, compensation on failure, concurrent protection, opportunistic cleanup, and reconciliation.

7. **Architecture, job runner, security** — updated with new tables, deduplication, system runs, webhook verification, and failure injection safety.
