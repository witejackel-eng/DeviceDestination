-- Phase 3: Atomic inventory operations via PostgreSQL functions + append-only ledger
--
-- The neon-http driver does not support interactive transactions, so critical
-- inventory mutations are encapsulated in SECURITY DEFINER functions that use
-- row-level locks internally. Each function:
--   - Validates the expected reservation status
--   - Validates stock availability
--   - Updates inventory counters
--   - Updates reservation state
--   - Records an immutable inventory_ledger entry
--   - Returns the resulting state
--   - Fails without partial changes (all inside a single transaction)
--
-- The ledger is append-only with a unique operation_id to prevent replay.

-- ─── Inventory ledger ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "inventory_ledger" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "operation_id" text NOT NULL,
  "product_id" uuid NOT NULL REFERENCES "products"("id") ON DELETE RESTRICT,
  "order_id" uuid REFERENCES "orders"("id") ON DELETE SET NULL,
  "reservation_id" uuid REFERENCES "inventory_reservations"("id") ON DELETE SET NULL,
  "operation_type" text NOT NULL CHECK (
    "operation_type" IN ('reserve','consume','release','expire','adjust','reconcile','reserve_failed','consume_failed','release_failed')
  ),
  "quantity_delta" integer NOT NULL,
  "reserved_delta" integer NOT NULL,
  "available_before" integer,
  "available_after" integer,
  "reserved_before" integer NOT NULL,
  "reserved_after" integer NOT NULL,
  "actor" text,
  "idempotency_key" text,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

-- Unique operation_id prevents replay of the same operation.
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_ledger_operation_id_idx"
  ON "inventory_ledger" ("operation_id");

-- Index for querying by product (reconciliation queries).
CREATE INDEX IF NOT EXISTS "inventory_ledger_product_idx"
  ON "inventory_ledger" ("product_id", "created_at");

-- Index for querying by order.
CREATE INDEX IF NOT EXISTS "inventory_ledger_order_idx"
  ON "inventory_ledger" ("order_id");

-- Index for querying by reservation.
CREATE INDEX IF NOT EXISTS "inventory_ledger_reservation_idx"
  ON "inventory_ledger" ("reservation_id");

-- ─── Inventory invariants (CHECK constraints) ────────────────────────────

-- reserved must be non-negative.
DO $$ BEGIN
  ALTER TABLE "inventory" ADD CONSTRAINT "inventory_reserved_nonnegative"
    CHECK ("reserved" >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- quantity_available must be non-negative when not null.
DO $$ BEGIN
  ALTER TABLE "inventory" ADD CONSTRAINT "inventory_quantity_available_nonnegative"
    CHECK ("quantity_available" IS NULL OR "quantity_available" >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Reservation quantity must be positive.
DO $$ BEGIN
  ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_quantity_positive"
    CHECK ("quantity" > 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── Atomic function: reserve_inventory_for_order ────────────────────────
-- Atomically:
--   1. Insert a reservation row with status 'pending'
--   2. Lock the inventory row (FOR UPDATE)
--   3. Validate stock availability
--   4. Increment inventory.reserved
--   5. Activate the reservation (pending → active)
--   6. Write a ledger entry
--   7. Return the reservation ID
-- Fails (raises) without partial changes if any step fails.

CREATE OR REPLACE FUNCTION reserve_inventory_for_order(
  p_order_id uuid,
  p_product_id uuid,
  p_quantity integer,
  p_expires_at timestamptz,
  p_operation_id text,
  p_actor text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reservation_id uuid;
  v_inv record;
  v_reserved_before integer;
  v_available_before integer;
BEGIN
  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'Invalid quantity %', p_quantity USING ERRCODE = '23514';
  END IF;

  -- Insert the reservation row first (pending).
  INSERT INTO "inventory_reservations" ("order_id", "product_id", "quantity", "status", "expires_at")
  VALUES (p_order_id, p_product_id, p_quantity, 'pending', p_expires_at)
  RETURNING "id" INTO v_reservation_id;

  -- Lock and read the inventory row.
  SELECT "quantity_available", "reserved" INTO v_inv
  FROM "inventory"
  WHERE "product_id" = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    -- No inventory row — mark reservation failed and raise.
    UPDATE "inventory_reservations" SET "status" = 'failed', "updated_at" = now()
    WHERE "id" = v_reservation_id;
    INSERT INTO "inventory_ledger"
      ("operation_id","product_id","order_id","reservation_id","operation_type","quantity_delta","reserved_delta","reserved_before","reserved_after","actor")
    VALUES
      (p_operation_id, p_product_id, p_order_id, v_reservation_id, 'reserve_failed', 0, 0, 0, 0, p_actor);
    RAISE EXCEPTION 'No inventory row for product %', p_product_id USING ERRCODE = 'P0002';
  END IF;

  v_reserved_before := COALESCE(v_inv.reserved, 0);
  v_available_before := COALESCE(v_inv.quantity_available, 0);

  -- Validate stock availability.
  IF v_available_before - v_reserved_before < p_quantity THEN
    UPDATE "inventory_reservations" SET "status" = 'failed', "updated_at" = now()
    WHERE "id" = v_reservation_id;
    INSERT INTO "inventory_ledger"
      ("operation_id","product_id","order_id","reservation_id","operation_type","quantity_delta","reserved_delta","available_before","available_after","reserved_before","reserved_after","actor")
    VALUES
      (p_operation_id, p_product_id, p_order_id, v_reservation_id, 'reserve_failed', 0, 0, v_available_before, v_available_before, v_reserved_before, v_reserved_before, p_actor);
    RAISE EXCEPTION 'Insufficient stock for product %', p_product_id USING ERRCODE = 'P0003';
  END IF;

  -- Increment reserved.
  UPDATE "inventory"
  SET "reserved" = v_reserved_before + p_quantity, "updated_at" = now()
  WHERE "product_id" = p_product_id;

  -- Activate the reservation (pending → active).
  UPDATE "inventory_reservations"
  SET "status" = 'active', "updated_at" = now()
  WHERE "id" = v_reservation_id AND "status" = 'pending';

  -- Write the ledger entry.
  INSERT INTO "inventory_ledger"
    ("operation_id","product_id","order_id","reservation_id","operation_type","quantity_delta","reserved_delta","available_before","available_after","reserved_before","reserved_after","actor")
  VALUES
    (p_operation_id, p_product_id, p_order_id, v_reservation_id, 'reserve', 0, p_quantity, v_available_before, v_available_before, v_reserved_before, v_reserved_before + p_quantity, p_actor);

  RETURN v_reservation_id;
END;
$$;

-- ─── Atomic function: consume_reservation ────────────────────────────────
-- Atomically:
--   1. Lock the reservation row (FOR UPDATE)
--   2. Validate status is 'active'
--   3. Lock the inventory row (FOR UPDATE)
--   4. Decrement reserved and quantityAvailable
--   5. Mark reservation consumed (active → consumed)
--   6. Write a ledger entry
--   7. Return the consumed quantity
-- Fails without partial changes.

CREATE OR REPLACE FUNCTION consume_reservation(
  p_reservation_id uuid,
  p_operation_id text,
  p_actor text DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_res record;
  v_inv record;
  v_reserved_before integer;
  v_available_before integer;
BEGIN
  -- Lock and read the reservation.
  SELECT "order_id", "product_id", "quantity", "status" INTO v_res
  FROM "inventory_reservations"
  WHERE "id" = p_reservation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reservation % not found', p_reservation_id USING ERRCODE = 'P0002';
  END IF;

  -- Idempotent: already consumed is a no-op (return 0).
  IF v_res.status = 'consumed' THEN
    RETURN 0;
  END IF;

  -- Only active reservations can be consumed.
  IF v_res.status != 'active' THEN
    RAISE EXCEPTION 'Cannot consume reservation in status %', v_res.status USING ERRCODE = 'P0003';
  END IF;

  -- Lock and read the inventory.
  SELECT "quantity_available", "reserved" INTO v_inv
  FROM "inventory"
  WHERE "product_id" = v_res.product_id
  FOR UPDATE;

  v_reserved_before := COALESCE(v_inv.reserved, 0);
  v_available_before := COALESCE(v_inv.quantity_available, 0);

  -- Decrement both reserved and quantityAvailable.
  -- The CHECK constraints enforce non-negativity.
  UPDATE "inventory"
  SET
    "reserved" = v_reserved_before - v_res.quantity,
    "quantity_available" = v_available_before - v_res.quantity,
    "updated_at" = now()
  WHERE "product_id" = v_res.product_id;

  -- Mark reservation consumed.
  UPDATE "inventory_reservations"
  SET "status" = 'consumed', "consumed_at" = now(), "updated_at" = now()
  WHERE "id" = p_reservation_id;

  -- Write the ledger entry.
  INSERT INTO "inventory_ledger"
    ("operation_id","product_id","order_id","reservation_id","operation_type","quantity_delta","reserved_delta","available_before","available_after","reserved_before","reserved_after","actor")
  VALUES
    (p_operation_id, v_res.product_id, v_res.order_id, p_reservation_id, 'consume', -v_res.quantity, -v_res.quantity, v_available_before, v_available_before - v_res.quantity, v_reserved_before, v_reserved_before - v_res.quantity, p_actor);

  RETURN v_res.quantity;
END;
$$;

-- ─── Atomic function: release_reservation ────────────────────────────────
-- Atomically:
--   1. Lock the reservation row (FOR UPDATE)
--   2. Validate status is 'active' (or idempotent skip for released/failed)
--   3. Lock the inventory row (FOR UPDATE)
--   4. Decrement reserved
--   5. Mark reservation released (active → released)
--   6. Write a ledger entry
--   7. Return the released quantity

CREATE OR REPLACE FUNCTION release_reservation(
  p_reservation_id uuid,
  p_reason text,
  p_operation_id text,
  p_actor text DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_res record;
  v_inv record;
  v_reserved_before integer;
  v_available_before integer;
BEGIN
  -- Lock and read the reservation.
  SELECT "order_id", "product_id", "quantity", "status" INTO v_res
  FROM "inventory_reservations"
  WHERE "id" = p_reservation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reservation % not found', p_reservation_id USING ERRCODE = 'P0002';
  END IF;

  -- Idempotent: already released/failed/expired is a no-op (return 0).
  IF v_res.status IN ('released', 'failed', 'expired', 'cancelled') THEN
    RETURN 0;
  END IF;

  -- Only active reservations can be released.
  IF v_res.status != 'active' THEN
    RAISE EXCEPTION 'Cannot release reservation in status %', v_res.status USING ERRCODE = 'P0003';
  END IF;

  -- Lock and read the inventory.
  SELECT "quantity_available", "reserved" INTO v_inv
  FROM "inventory"
  WHERE "product_id" = v_res.product_id
  FOR UPDATE;

  v_reserved_before := COALESCE(v_inv.reserved, 0);
  v_available_before := COALESCE(v_inv.quantity_available, 0);

  -- Decrement reserved.
  UPDATE "inventory"
  SET "reserved" = v_reserved_before - v_res.quantity, "updated_at" = now()
  WHERE "product_id" = v_res.product_id;

  -- Mark reservation released.
  UPDATE "inventory_reservations"
  SET "status" = 'released', "released_at" = now(), "release_reason" = p_reason, "updated_at" = now()
  WHERE "id" = p_reservation_id;

  -- Write the ledger entry.
  INSERT INTO "inventory_ledger"
    ("operation_id","product_id","order_id","reservation_id","operation_type","quantity_delta","reserved_delta","available_before","available_after","reserved_before","reserved_after","actor")
  VALUES
    (p_operation_id, v_res.product_id, v_res.order_id, p_reservation_id, 'release', 0, -v_res.quantity, v_available_before, v_available_before, v_reserved_before, v_reserved_before - v_res.quantity, p_actor);

  RETURN v_res.quantity;
END;
$$;

-- ─── Atomic function: expire_reservation ─────────────────────────────────
-- Like release_reservation but for expired reservations. Same atomicity.

CREATE OR REPLACE FUNCTION expire_reservation(
  p_reservation_id uuid,
  p_operation_id text,
  p_actor text DEFAULT NULL
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_res record;
  v_inv record;
  v_reserved_before integer;
  v_available_before integer;
BEGIN
  SELECT "order_id", "product_id", "quantity", "status", "expires_at" INTO v_res
  FROM "inventory_reservations"
  WHERE "id" = p_reservation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reservation % not found', p_reservation_id USING ERRCODE = 'P0002';
  END IF;

  IF v_res.status IN ('released', 'failed', 'expired', 'cancelled', 'consumed') THEN
    RETURN 0;
  END IF;

  IF v_res.status != 'active' THEN
    RAISE EXCEPTION 'Cannot expire reservation in status %', v_res.status USING ERRCODE = 'P0003';
  END IF;

  SELECT "quantity_available", "reserved" INTO v_inv
  FROM "inventory"
  WHERE "product_id" = v_res.product_id
  FOR UPDATE;

  v_reserved_before := COALESCE(v_inv.reserved, 0);
  v_available_before := COALESCE(v_inv.quantity_available, 0);

  UPDATE "inventory"
  SET "reserved" = v_reserved_before - v_res.quantity, "updated_at" = now()
  WHERE "product_id" = v_res.product_id;

  UPDATE "inventory_reservations"
  SET "status" = 'expired', "released_at" = now(), "release_reason" = 'expired', "updated_at" = now()
  WHERE "id" = p_reservation_id;

  INSERT INTO "inventory_ledger"
    ("operation_id","product_id","order_id","reservation_id","operation_type","quantity_delta","reserved_delta","available_before","available_after","reserved_before","reserved_after","actor")
  VALUES
    (p_operation_id, v_res.product_id, v_res.order_id, p_reservation_id, 'expire', 0, -v_res.quantity, v_available_before, v_available_before, v_reserved_before, v_reserved_before - v_res.quantity, p_actor);

  RETURN v_res.quantity;
END;
$$;

-- ─── Atomic function: adjust_inventory ───────────────────────────────────
-- Manual adjustment (receipt, correction, damage, return). Adjusts
-- quantityAvailable by p_delta and writes a ledger entry.

CREATE OR REPLACE FUNCTION adjust_inventory(
  p_product_id uuid,
  p_delta integer,
  p_reason text,
  p_actor text,
  p_operation_id text
) RETURNS table(quantity_after integer, reserved_after integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv record;
  v_available_before integer;
  v_reserved_before integer;
BEGIN
  SELECT "quantity_available", "reserved" INTO v_inv
  FROM "inventory"
  WHERE "product_id" = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No inventory row for product %', p_product_id USING ERRCODE = 'P0002';
  END IF;

  v_available_before := COALESCE(v_inv.quantity_available, 0);
  v_reserved_before := COALESCE(v_inv.reserved, 0);

  IF v_available_before + p_delta < 0 THEN
    RAISE EXCEPTION 'Adjustment would make quantity_available negative' USING ERRCODE = '23514';
  END IF;

  UPDATE "inventory"
  SET "quantity_available" = v_available_before + p_delta, "updated_at" = now()
  WHERE "product_id" = p_product_id;

  INSERT INTO "inventory_ledger"
    ("operation_id","product_id","operation_type","quantity_delta","reserved_delta","available_before","available_after","reserved_before","reserved_after","actor")
  VALUES
    (p_operation_id, p_product_id, 'adjust', p_delta, 0, v_available_before, v_available_before + p_delta, v_reserved_before, v_reserved_before, p_actor);

  RETURN QUERY SELECT v_available_before + p_delta, v_reserved_before;
END;
$$;
