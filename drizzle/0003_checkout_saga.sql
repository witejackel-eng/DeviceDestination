-- Phase 2: Checkout idempotency and saga compensation
--
-- Adds the `manual_intervention_required` terminal state to the checkout
-- attempt status enum. This state is used when automatic compensation is
-- unsafe — e.g. when a Razorpay order may have been created but we could not
-- durably persist its ID, or when a payment may have been captured but the
-- local order row is in an inconsistent state.
--
-- Also adds:
--   - `intervention_reason` column for a safe, human-readable explanation
--     of why the attempt needs manual review (never contains secrets).
--   - `checkout_attempts_status_updated_idx` index to make stale-attempt
--     recovery queries cheap (WHERE status IN (...) AND updated_at < ...).

-- Add the new enum value. ALTER TYPE ... ADD VALUE cannot run inside a
-- transaction block in older Postgres, but drizzle-kit wraps each migration
-- in a transaction. Postgres 12+ supports ADD VALUE inside a transaction
-- as long as the value is not used in the same transaction.
ALTER TYPE "checkout_attempt_status" ADD VALUE IF NOT EXISTS 'manual_intervention_required';

-- Intervention reason column.
ALTER TABLE "checkout_attempts"
  ADD COLUMN IF NOT EXISTS "intervention_reason" text;

-- Index for stale-attempt recovery queries.
CREATE INDEX IF NOT EXISTS "checkout_attempts_status_updated_idx"
  ON "checkout_attempts" ("status", "updated_at");
