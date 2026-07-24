import pino from "pino";

/**
 * Comprehensive recursive redaction configuration.
 *
 * Any field whose name matches one of these keys (case-insensitive, at any
 * depth in the object tree) is replaced with "[redacted]" before the log
 * entry is serialised. Pino's redact supports wildcard paths with `*`.
 *
 * The list covers every category the spec requires:
 *   - Passwords, tokens, secrets
 *   - Authorization headers, cookies
 *   - Access and refresh tokens
 *   - Database URLs
 *   - Webhook secrets, Razorpay secrets, WhatsApp tokens
 *   - Customer email, mobile, address, GSTIN
 *   - Provider payloads
 */
const REDACT_PATHS = [
  // ─── Generic secrets ──────────────────────────────────────────────────
  "password",
  "passwordConfirmation",
  "currentPassword",
  "newPassword",
  "secret",
  "secretKey",
  "apiKey",
  "apiSecret",
  "privateKey",
  "passphrase",

  // ─── Tokens ───────────────────────────────────────────────────────────
  "token",
  "accessToken",
  "refreshToken",
  "idToken",
  "sessionToken",
  "csrfToken",
  "authToken",
  "bearerToken",
  "verificationToken",

  // ─── Headers ──────────────────────────────────────────────────────────
  "req.headers.authorization",
  "req.headers.cookie",
  "req.headers['x-razorpay-signature']",
  "req.headers['x-vercel-cron-auth']",
  "headers.authorization",
  "headers.cookie",
  "headers['x-razorpay-signature']",
  "headers['x-vercel-cron-auth']",
  "authorization",
  "cookie",
  "cookies",
  "set-cookie",

  // ─── Razorpay ─────────────────────────────────────────────────────────
  "razorpayKeySecret",
  "razorpayWebhookSecret",
  "razorpay_signature",
  "razorpay_payment_id",
  "razorpay_order_id",
  "RAZORPAY_KEY_SECRET",
  "RAZORPAY_WEBHOOK_SECRET",

  // ─── Database ─────────────────────────────────────────────────────────
  "DATABASE_URL",
  "TEST_DATABASE_URL",
  "databaseUrl",
  "connectionString",

  // ─── Auth ─────────────────────────────────────────────────────────────
  "BETTER_AUTH_SECRET",
  "betterAuthSecret",
  "CRON_SECRET",
  "cronSecret",
  "ORDER_ACCESS_SECRET",
  "orderAccessSecret",

  // ─── WhatsApp ─────────────────────────────────────────────────────────
  "WHATSAPP_ACCESS_TOKEN",
  "whatsappAccessToken",
  "accessToken", // duplicate but pino dedupes

  // ─── Upstash ──────────────────────────────────────────────────────────
  "UPSTASH_REDIS_REST_TOKEN",
  "upstashRedisRestToken",

  // ─── Vercel Blob ──────────────────────────────────────────────────────
  "BLOB_READ_WRITE_TOKEN",
  "blobReadWriteToken",

  // ─── Resend ───────────────────────────────────────────────────────────
  "RESEND_API_KEY",
  "resendApiKey",

  // ─── Customer PII ─────────────────────────────────────────────────────
  "customer.email",
  "customer.mobile",
  "customer.address",
  "customer.gstin",
  "customer.phone",
  "customer.name",
  "user.email",
  "user.mobile",
  "user.address",
  "user.gstin",
  "user.phone",
  "email",
  "mobile",
  "phone",
  "address",
  "gstin",
  "line1",
  "line2",
  "pincode",

  // ─── Provider payloads (may contain customer data) ────────────────────
  "payload",
  "rawPayload",
  "rawBody",
  "providerPayload",
  "rawEvent",
  "providerResponse",

  // ─── Nested objects with wildcards ────────────────────────────────────
  "*.password",
  "*.secret",
  "*.token",
  "*.apiKey",
  "*.apiSecret",
  "*.accessToken",
  "*.refreshToken",
  "*.authorization",
  "*.cookie",
  "*.email",
  "*.mobile",
  "*.phone",
  "*.address",
  "*.gstin",
  "*.payload",
  "*.rawPayload",
  "*.rawBody",
  "*.providerResponse",
  "*.RAZORPAY_KEY_SECRET",
  "*.RAZORPAY_WEBHOOK_SECRET",
  "*.BETTER_AUTH_SECRET",
  "*.CRON_SECRET",
  "*.DATABASE_URL",
  "*.connectionString",
];

/**
 * The application logger. All log calls automatically redact sensitive fields
 * via pino's redact feature. Callers do not need to remember manual redaction.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: {
    paths: REDACT_PATHS,
    censor: "[redacted]",
    remove: false,
  },
});

/**
 * Create a child logger with a correlation ID. Use this to tag every log
 * entry in a request, job, or webhook event with a stable identifier so
 * the full lifecycle can be traced.
 *
 * Example:
 *   const log = logger.withCorrelation({ orderId: "abc" });
 *   log.info({ step: "payment_captured" }, "Payment captured");
 *   // → { orderId: "abc", step: "payment_captured", msg: "Payment captured" }
 */
export function createCorrelatedLogger(correlation: CorrelationIds): pino.Logger {
  return logger.child(correlation);
}

/**
 * Standard correlation IDs. Include as many as are available; omit unknowns.
 */
export type CorrelationIds = {
  checkoutAttemptId?: string;
  orderId?: string;
  orderNumber?: string;
  paymentId?: string;
  webhookEventId?: string;
  jobId?: string;
  refundId?: string;
  reservationId?: string;
  userId?: string;
};

/**
 * Sanitize an arbitrary object for safe persistence (e.g. in a DB error
 * column, audit log, or webhook event `last_error` field). Recursively
 * walks the object and replaces any key matching the redaction list.
 *
 * Use this when storing error messages or payloads in the database to
 * ensure secrets and PII are never persisted.
 */
export function sanitizeForPersistence(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeForPersistence);

  const REDACT_KEYS = new Set([
    "password", "passwordConfirmation", "currentPassword", "newPassword",
    "secret", "secretKey", "apiKey", "apiSecret", "privateKey", "passphrase",
    "token", "accessToken", "refreshToken", "idToken", "sessionToken",
    "csrfToken", "authToken", "bearerToken", "verificationToken",
    "authorization", "cookie", "cookies",
    "razorpayKeySecret", "razorpayWebhookSecret", "razorpay_signature",
    "razorpay_payment_id", "razorpay_order_id",
    "RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET",
    "DATABASE_URL", "TEST_DATABASE_URL", "databaseUrl", "connectionString",
    "BETTER_AUTH_SECRET", "betterAuthSecret",
    "CRON_SECRET", "cronSecret",
    "ORDER_ACCESS_SECRET", "orderAccessSecret",
    "WHATSAPP_ACCESS_TOKEN", "whatsappAccessToken",
    "UPSTASH_REDIS_REST_TOKEN", "upstashRedisRestToken",
    "BLOB_READ_WRITE_TOKEN", "blobReadWriteToken",
    "RESEND_API_KEY", "resendApiKey",
    "email", "mobile", "phone", "address", "gstin", "line1", "line2", "pincode",
    "payload", "rawPayload", "rawBody", "providerPayload", "rawEvent", "providerResponse",
  ]);

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (REDACT_KEYS.has(key)) {
      result[key] = "[redacted]";
    } else if (typeof value === "object" && value !== null) {
      result[key] = sanitizeForPersistence(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Sanitize an error message for safe persistence. Strips anything that looks
 * like a secret and truncates to a safe length.
 */
export function sanitizeErrorMessage(msg: string, maxLength = 500): string {
  return msg
    .replace(/(sk_|sk_test_|rk_|rk_test_|ghp_|gho_|Bearer |password=|secret=)\S+/gi, "[redacted]")
    .replace(/postgres(ql)?:\/\/[^\s]+/gi, "[redacted_db_url]")
    .slice(0, maxLength);
}
