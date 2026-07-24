-- Phase 4: Job claiming, leases, dead-letter, and deduplication hardening
--
-- Adds:
--   - `dead_letter` and `deferred` to the job_status enum
--   - `lease_expires_at` column for job leases
--   - `recovery_count` column to track how many times a job was reclaimed
--   - An index on `lease_expires_at` for cheap stale-job queries
--   - Changes the dedupe unique index to only cover pending+processing
--     (not completed) so legitimate resends work

-- Add new enum values.
ALTER TYPE "job_status" ADD VALUE IF NOT EXISTS 'dead_letter';
ALTER TYPE "job_status" ADD VALUE IF NOT EXISTS 'deferred';

-- Lease expiry column.
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "lease_expires_at" timestamptz;

-- Recovery count column.
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "recovery_count" integer NOT NULL DEFAULT 0;

-- Index for stale-lease queries.
CREATE INDEX IF NOT EXISTS "jobs_lease_expires_idx" ON "jobs" ("lease_expires_at");

-- Replace the dedupe index: only pending+processing (not completed).
-- This lets a legitimate resend create a new job even if an old completed
-- job has the same dedupe key.
DROP INDEX IF EXISTS "jobs_dedupe_key_active_idx";
CREATE UNIQUE INDEX "jobs_dedupe_key_active_idx"
  ON "jobs" ("dedupe_key")
  WHERE "status" IN ('pending', 'processing');

-- ─── Atomic function: claim_jobs ──────────────────────────────────────────
-- Uses a CTE with FOR UPDATE SKIP LOCKED to claim a bounded batch of jobs.
-- Only the selected jobs are moved to 'processing'; no extras are claimed
-- and released afterwards (the old anti-pattern).

CREATE OR REPLACE FUNCTION claim_jobs(
  p_worker_id text,
  p_batch_size integer DEFAULT 5,
  p_lease_seconds integer DEFAULT 120
) RETURNS table(
  id uuid,
  type text,
  payload jsonb,
  attempts integer,
  max_attempts integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_lease_expires timestamptz := now() + (p_lease_seconds || ' seconds')::interval;
BEGIN
  RETURN QUERY
  WITH claimable AS (
    SELECT "id"
    FROM "jobs"
    WHERE "status" = 'pending'
      AND "run_after" <= v_now
    ORDER BY "run_after" ASC, "id" ASC
    FOR UPDATE SKIP LOCKED
    LIMIT p_batch_size
  )
  UPDATE "jobs"
  SET
    "status" = 'processing',
    "locked_at" = v_now,
    "locked_by" = p_worker_id,
    "lease_expires_at" = v_lease_expires,
    "attempts" = "attempts" + 1,
    "updated_at" = v_now
  FROM claimable
  WHERE "jobs"."id" = claimable."id"
  RETURNING "jobs"."id", "jobs"."type", "jobs"."payload", "jobs"."attempts", "jobs"."max_attempts";
END;
$$;

-- ─── Atomic function: reclaim_stale_jobs ─────────────────────────────────
-- Finds processing jobs whose lease has expired and returns them to pending.
-- Increments recovery_count. Moves to dead_letter if recovery_count exceeds
-- max_attempts.

CREATE OR REPLACE FUNCTION reclaim_stale_jobs(
  p_max_recoveries integer DEFAULT 3
) RETURNS table(id uuid, action text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
BEGIN
  RETURN QUERY
  WITH stale AS (
    SELECT "id", "attempts", "max_attempts", "recovery_count", "locked_by"
    FROM "jobs"
    WHERE "status" = 'processing'
      AND "lease_expires_at" IS NOT NULL
      AND "lease_expires_at" < v_now
    FOR UPDATE SKIP LOCKED
  )
  UPDATE "jobs"
  SET
    "status" = CASE
      WHEN stale."recovery_count" >= p_max_recoveries OR stale."attempts" >= stale."max_attempts"
        THEN 'dead_letter'
      ELSE 'pending'
    END,
    "recovery_count" = stale."recovery_count" + 1,
    "locked_at" = NULL,
    "locked_by" = NULL,
    "lease_expires_at" = NULL,
    "last_error" = CASE
      WHEN stale."recovery_count" >= p_max_recoveries OR stale."attempts" >= stale."max_attempts"
        THEN COALESCE("last_error", '') || ' [moved to dead_letter: lease expired ' || v_now::text || ']'
      ELSE "last_error"
    END,
    "updated_at" = v_now
  FROM stale
  WHERE "jobs"."id" = stale."id"
  RETURNING "jobs"."id",
    CASE
      WHEN stale."recovery_count" >= p_max_recoveries OR stale."attempts" >= stale."max_attempts"
        THEN 'dead_lettered'
      ELSE 'reclaimed'
    END;
END;
$$;
