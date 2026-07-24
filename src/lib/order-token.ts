import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { eq, and, isNull, lt } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/db/client";
import { orderAccessTokens } from "@/db/schema";
import { logger } from "@/lib/logger";

/**
 * Order-access token system.
 *
 * Each token is a 32-byte cryptographically-secure random value, base64url-
 * encoded (43 chars). The token is stored as a SHA-256 hash (never plaintext).
 * The raw value is only returned to the caller once at creation time.
 *
 * Tokens are:
 *   - Purpose-specific (order_status, invoice_download, guest_claim, email_verification)
 *   - Short-lived (default 24h, configurable per purpose)
 *   - Revocable (admin or system can revoke)
 *   - Use-limited (optional max_uses)
 *   - Audited (last_used_at, use_count)
 *
 * The token value is exchanged for a short-lived HTTP-only cookie so it
 * does not remain in URLs.
 */

export type OrderTokenPurpose = "order_status" | "invoice_download" | "guest_claim" | "email_verification";

const PURPOSE_EXPIRY_HOURS: Record<OrderTokenPurpose, number> = {
  order_status: 24 * 7, // 7 days
  invoice_download: 24 * 30, // 30 days (invoices are immutable)
  guest_claim: 1, // 1 hour (short-lived for claim flow)
  email_verification: 1, // 1 hour
};

const PURPOSE_MAX_USES: Record<OrderTokenPurpose, number | null> = {
  order_status: null, // unlimited until expiry
  invoice_download: null,
  guest_claim: 1, // single use
  email_verification: 1, // single use
};

/**
 * Generate a random 32-byte token, base64url-encoded.
 */
function generateTokenValue(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Hash a token value with SHA-256. The hash is what we store.
 */
function hashToken(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * Create a new order-access token. Returns the raw token value (only visible
 * at creation time) and the token record.
 */
export async function createOrderAccessToken(input: {
  orderId?: string;
  orderNumber: string;
  purpose: OrderTokenPurpose;
  expiresAt?: Date;
  maxUses?: number;
}): Promise<{ token: string; expiresAt: Date; purpose: OrderTokenPurpose }> {
  if (!isDatabaseConfigured()) {
    throw new Error("Database is not configured — cannot create order access token");
  }
  const db = getDb();
  const tokenValue = generateTokenValue();
  const tokenHash = hashToken(tokenValue);
  const expiresAt = input.expiresAt ?? new Date(Date.now() + PURPOSE_EXPIRY_HOURS[input.purpose] * 60 * 60 * 1000);
  const maxUses = input.maxUses ?? PURPOSE_MAX_USES[input.purpose];

  await db.insert(orderAccessTokens).values({
    tokenHash,
    orderId: input.orderId ?? null,
    orderNumber: input.orderNumber,
    purpose: input.purpose,
    expiresAt,
    maxUses,
  });

  return { token: tokenValue, expiresAt, purpose: input.purpose };
}

/**
 * Validate and consume an order-access token. Uses the atomic
 * consume_order_access_token function which locks the row, checks
 * expiry/revocation/max_uses, and increments use_count in a single
 * transaction.
 *
 * Returns the order context if valid, or an error reason if invalid.
 */
export async function consumeOrderAccessToken(token: string): Promise<{
  valid: boolean;
  orderId?: string;
  orderNumber?: string;
  purpose?: OrderTokenPurpose;
  reason?: string;
}> {
  if (!isDatabaseConfigured()) {
    return { valid: false, reason: "db_unconfigured" };
  }
  const db = getDb();
  const tokenHash = hashToken(token);

  try {
    const result = await db.execute(sql`
      SELECT * FROM consume_order_access_token(${tokenHash}::text)
    `);
    const rows = Array.isArray(result) ? result : ((result as { rows?: Array<Record<string, unknown>> }).rows ?? []);
    const row = rows[0];
    if (!row) return { valid: false, reason: "not_found" };

    if (!row.valid) {
      return { valid: false, reason: String(row.reason) };
    }

    return {
      valid: true,
      orderId: row.order_id ? String(row.order_id) : undefined,
      orderNumber: String(row.order_number),
      purpose: String(row.purpose) as OrderTokenPurpose,
    };
  } catch (error) {
    logger.error(
      { event: "order_token_consume_failed", error: error instanceof Error ? error.message : "unknown" },
      "Failed to consume order access token",
    );
    return { valid: false, reason: "error" };
  }
}

/**
 * Revoke all tokens for an order. Used when an order is cancelled or when
 * an admin wants to invalidate all access paths.
 */
export async function revokeOrderTokens(orderId: string, reason = "revoked"): Promise<number> {
  if (!isDatabaseConfigured()) return 0;
  const db = getDb();
  const result = await db
    .update(orderAccessTokens)
    .set({ revokedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(orderAccessTokens.orderId, orderId),
        isNull(orderAccessTokens.revokedAt),
      ),
    )
    .returning({ id: orderAccessTokens.id });
  logger.info(
    { event: "order_tokens_revoked", orderId, count: result.length, reason },
    "Order access tokens revoked",
  );
  return result.length;
}

/**
 * Revoke a single token by its raw value (e.g. on logout).
 */
export async function revokeOrderTokenByValue(token: string): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;
  const db = getDb();
  const tokenHash = hashToken(token);
  const result = await db
    .update(orderAccessTokens)
    .set({ revokedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(orderAccessTokens.tokenHash, tokenHash),
        isNull(orderAccessTokens.revokedAt),
      ),
    )
    .returning({ id: orderAccessTokens.id });
  return result.length > 0;
}

/**
 * Delete expired tokens. Called from the cron runner.
 */
export async function cleanupExpiredOrderTokens(): Promise<number> {
  if (!isDatabaseConfigured()) return 0;
  const db = getDb();
  const result = await db
    .delete(orderAccessTokens)
    .where(lt(orderAccessTokens.expiresAt, new Date()))
    .returning({ id: orderAccessTokens.id });
  return result.length;
}

// ─── Legacy compatibility ──────────────────────────────────────────────────
//
// The checkout orchestrator calls createOrderConfirmationToken for the
// test-mode flow. We keep a synchronous wrapper for backwards compatibility
// that delegates to the test-mode flow (no DB needed).

/**
 * @deprecated Use createOrderAccessToken instead. This synchronous function
 * is retained only for the test-mode checkout flow which does not have a
 * database connection. It produces a short-lived, non-stored token that is
 * only valid for the test-mode confirmation page.
 */
export function createOrderConfirmationToken(orderNumber: string): string {
  // In test mode, there's no DB to store tokens. We use a signed token
  // derived from a dedicated test secret (NOT RAZORPAY_KEY_SECRET or
  // BETTER_AUTH_SECRET). This is only used in non-production test mode.
  const secret = process.env.ORDER_ACCESS_SECRET ?? "test-mode-order-access-secret";
  const payload = `${orderNumber}:${Math.floor(Date.now() / 1000)}`;
  const sig = createHash("sha256").update(`${payload}:${secret}`).digest("hex");
  return `${Buffer.from(payload).toString("base64url")}.${sig}`;
}

/**
 * @deprecated Use consumeOrderAccessToken instead.
 */
export function verifyOrderConfirmationToken(orderNumber: string, token: string): boolean {
  try {
    const [payloadB64, sig] = token.split(".");
    if (!payloadB64 || !sig) return false;
    const payload = Buffer.from(payloadB64, "base64url").toString();
    const [storedOrderNumber, timestamp] = payload.split(":");
    if (storedOrderNumber !== orderNumber) return false;
    // Test-mode tokens expire after 1 hour.
    const age = Date.now() / 1000 - Number(timestamp);
    if (age > 3600) return false;
    const secret = process.env.ORDER_ACCESS_SECRET ?? "test-mode-order-access-secret";
    const expectedSig = createHash("sha256").update(`${payload}:${secret}`).digest("hex");
    const a = Buffer.from(expectedSig);
    const b = Buffer.from(sig);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
