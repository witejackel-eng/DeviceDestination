-- Phase 8: Dedicated order-access token table
--
-- Replaces the deterministic HMAC-of-order-number token with a proper
-- short-lived, revocable, purpose-specific token table.
--
-- Each token:
--   - Contains a random cryptographically-secure value (never reused)
--   - Is stored as a SHA-256 hash (never plaintext)
--   - Has a purpose (order_status, invoice_download, guest_claim, email_verification)
--   - Has a creation time, expiry time, and optional revocation time
--   - Tracks last-used time and use count for max-use policies
--   - References the order it grants access to
--
-- The token value is only returned to the client once at creation time.
-- Subsequent lookups hash the provided value and compare to the stored hash.

CREATE TABLE IF NOT EXISTS "order_access_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "token_hash" text NOT NULL,
  "order_id" uuid REFERENCES "orders"("id") ON DELETE CASCADE,
  "order_number" text NOT NULL,
  "purpose" text NOT NULL CHECK (
    "purpose" IN ('order_status', 'invoice_download', 'guest_claim', 'email_verification')
  ),
  "expires_at" timestamptz NOT NULL,
  "revoked_at" timestamptz,
  "last_used_at" timestamptz,
  "use_count" integer NOT NULL DEFAULT 0,
  "max_uses" integer, -- NULL = unlimited until expiry
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- Token hash is unique — two tokens cannot share the same hash.
CREATE UNIQUE INDEX IF NOT EXISTS "order_access_tokens_hash_idx"
  ON "order_access_tokens" ("token_hash");

-- Index for lookup by order (to list/revoke all tokens for an order).
CREATE INDEX IF NOT EXISTS "order_access_tokens_order_idx"
  ON "order_access_tokens" ("order_id");

-- Index for expiry-based cleanup.
CREATE INDEX IF NOT EXISTS "order_access_tokens_expires_idx"
  ON "order_access_tokens" ("expires_at");

-- Index for finding active tokens by purpose.
CREATE INDEX IF NOT EXISTS "order_access_tokens_purpose_idx"
  ON "order_access_tokens" ("purpose", "expires_at")
  WHERE "revoked_at" IS NULL;

-- ─── Atomic function: consume_order_access_token ─────────────────────────
-- Atomically validates, increments use_count, updates last_used_at, and
-- checks expiry/revocation/max_uses in a single transaction. Returns the
-- order_id if the token is valid, or NULL if invalid/expired/revoked.

CREATE OR REPLACE FUNCTION consume_order_access_token(
  p_token_hash text
) RETURNS table(
  order_id uuid,
  order_number text,
  purpose text,
  valid boolean,
  reason text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token record;
BEGIN
  -- Lock the token row.
  SELECT * INTO v_token
  FROM "order_access_tokens"
  WHERE "token_hash" = p_token_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::uuid, NULL::text, NULL::text, false, 'not_found';
    RETURN;
  END IF;

  -- Check revocation.
  IF v_token.revoked_at IS NOT NULL THEN
    RETURN QUERY SELECT NULL::uuid, NULL::text, NULL::text, false, 'revoked';
    RETURN;
  END IF;

  -- Check expiry.
  IF v_token.expires_at < now() THEN
    RETURN QUERY SELECT NULL::uuid, NULL::text, NULL::text, false, 'expired';
    RETURN;
  END IF;

  -- Check max uses.
  IF v_token.max_uses IS NOT NULL AND v_token.use_count >= v_token.max_uses THEN
    RETURN QUERY SELECT NULL::uuid, NULL::text, NULL::text, false, 'max_uses_exceeded';
    RETURN;
  END IF;

  -- Valid — increment use_count and update last_used_at.
  UPDATE "order_access_tokens"
  SET "use_count" = "use_count" + 1,
      "last_used_at" = now(),
      "updated_at" = now()
  WHERE "id" = v_token.id;

  RETURN QUERY SELECT v_token.order_id, v_token.order_number, v_token.purpose, true, 'ok';
END;
$$;
