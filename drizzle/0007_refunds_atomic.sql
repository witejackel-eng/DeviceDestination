-- Phase 7: Concurrency-safe refunds via atomic PostgreSQL function
--
-- The create_refund_atomic function locks the payment row, sums all existing
-- refunds (pending + processing + processed), validates the requested amount
-- won't exceed the captured amount, and inserts the refund — all in a single
-- transaction. Two concurrent refund requests cannot both succeed if their
-- combined total would exceed the captured amount.
--
-- The provider idempotency key is derived from the payment ID + amount + a
-- caller-supplied nonce, NOT from which administrator clicked. This means
-- the same refund retried by a different admin (or by the reconciliation
-- routine) produces the same provider idempotency key.

CREATE OR REPLACE FUNCTION create_refund_atomic(
  p_order_id uuid,
  p_payment_id uuid,
  p_amount_paise integer,
  p_reason text,
  p_requested_by text,
  p_idempotency_key text,
  p_provider_idempotency_key text
) RETURNS table(
  refund_id uuid,
  refund_status text,
  idempotent boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment record;
  v_already_refunded bigint;
  v_existing_refund_id uuid;
BEGIN
  -- Lock the payment row for the duration of this transaction.
  SELECT "id", "status", "amount_paise", "provider_payment_id" INTO v_payment
  FROM "payments"
  WHERE "id" = p_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment % not found', p_payment_id USING ERRCODE = 'P0002';
  END IF;

  -- Validate payment is captured (or partially refunded).
  IF v_payment.status NOT IN ('captured', 'refunded') THEN
    RAISE EXCEPTION 'Payment is in status %; only captured payments can be refunded',
      v_payment.status USING ERRCODE = 'P0003';
  END IF;

  -- Check for an existing refund with the same idempotency key.
  SELECT "id" INTO v_existing_refund_id
  FROM "refunds"
  WHERE "idempotency_key" = p_idempotency_key
  FOR UPDATE;

  IF FOUND THEN
    RETURN QUERY SELECT v_existing_refund_id, "status"::text, true
    FROM "refunds" WHERE "id" = v_existing_refund_id;
    RETURN;
  END IF;

  -- Sum all existing refunds (pending + processing + processed).
  SELECT COALESCE(SUM("amount_paise"), 0) INTO v_already_refunded
  FROM "refunds"
  WHERE "payment_id" = p_payment_id
    AND "status" IN ('pending', 'processing', 'processed');

  -- Validate the requested amount won't exceed the captured amount.
  IF v_already_refunded + p_amount_paise > v_payment.amount_paise THEN
    RAISE EXCEPTION 'Refund total (%) would exceed captured amount (%)',
      v_already_refunded + p_amount_paise, v_payment.amount_paise USING ERRCODE = 'P0003';
  END IF;

  -- Insert the refund record.
  INSERT INTO "refunds" (
    "order_id", "payment_id", "amount_paise", "reason",
    "status", "requested_by", "idempotency_key"
  ) VALUES (
    p_order_id, p_payment_id, p_amount_paise, p_reason,
    'pending', p_requested_by, p_idempotency_key
  )
  RETURNING "id" INTO v_existing_refund_id;

  RETURN QUERY SELECT v_existing_refund_id, 'pending'::text, false;
END;
$$;
