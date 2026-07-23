# Security

- No credentials or supplier costs are committed.
- Database, Redis, Resend and Razorpay clients are created lazily after environment checks.
- Customer input is validated on both client and server; server validation is authoritative.
- Cart totals are recalculated using trusted catalogue prices.
- Payment and webhook HMAC signatures use timing-safe comparison (`timingSafeEqual`).
- Confirmation pages require a server-signed token rather than trusting a URL or client callback.
- Auth uses HTTP-only Better Auth cookies; production cookies are secure.
- Contact and checkout endpoints use rate limits and honeypots.
- CSP, HSTS, frame restrictions, MIME sniffing protection, referrer and permissions policies are configured.
- Admin access requires both an authenticated session and `ADMIN_EMAILS` membership.
- Product downloads are static exact-model files; the validator rejects missing paths.
- Rate limiting on admin endpoints (5 requests per 10 minutes per identifier via Upstash or in-memory fallback).

Upstash is required for distributed production rate limiting. The in-memory fallback exists only to keep local development testable.

Run `npm audit` before every release and assess transitive findings by reachable production path rather than suppressing them. The 22 July 2026 audit reported no high or critical findings and nine moderate transitive findings: the development-only Drizzle toolchain carries the unfixed esbuild development-server advisory, while Next.js carries the unfixed PostCSS stringify advisory. Recheck both after dependency upgrades and before deployment.

## Webhook signature verification

The webhook route (`src/app/api/webhooks/razorpay/route.ts`) verifies the Razorpay HMAC signature **before trusting any payload**. The raw request body is read, and `verifyRazorpayWebhookSignature(payload, signature)` computes `HMAC-SHA256(RAZORPAY_WEBHOOK_SECRET, payload)` and compares it against the `x-razorpay-signature` header using `timingSafeEqual` (constant-time comparison).

If the signature is invalid, the route returns `401` immediately — no parsing, no database writes, no event recording, no business logic. This prevents forged webhook payloads from triggering payment processing, inventory changes, or order state transitions.

## Durable event recording

No business logic is executed before persisting a durable record of the webhook event in the `payment_webhook_events` table. The unique index on `provider_event_id` guarantees that each event is recorded exactly once, regardless of how many times Razorpay delivers it.

This means:
- If the server crashes mid-processing, the event row survives for recovery.
- Duplicate deliveries are harmlessly deduplicated.
- No processing happens without first creating an audit trail.

See [Webhook Recovery](webhook-recovery.md) for the full processing status flow.

## No secret logging

The payment processing system never logs:
- `RAZORPAY_KEY_SECRET` or any API key.
- `DATABASE_URL` or connection strings.
- `RAZORPAY_WEBHOOK_SECRET`.
- Provider response payloads (which may contain sensitive customer data).

Error messages stored in `payment_webhook_events.last_error` and `jobs.last_error` are truncated to 500 characters and filtered for known secret patterns. The audit helper (`src/lib/audit.ts`) uses `redactSecrets()` on every log entry.

## No provider payload dumping

Razorpay webhook payloads are parsed for the specific fields needed (event type, payment ID, order ID, amount, status) via a strict Zod schema. The raw JSON is never stored, never logged, and never forwarded. Only the extracted business-relevant fields are persisted in the `payment_webhook_events` table.

## Test-only failure injection safety

The failure injection system (`tests/helpers/failure-injection.ts`) is designed with multiple safety barriers:

1. **`assertTestEnvironment()`** — every function call checks `NODE_ENV !== "test"` and throws if not in a test environment. This makes it impossible to activate in production.
2. **Dependency-injected, not global state** — failures are injected by passing wrapped functions as parameters, not by modifying global variables or production-request parameters.
3. **No production API route** — there is no endpoint, query parameter, or environment variable that can trigger failure injection outside of test code.
4. **Module-level flag is test-only** — the `TEST_ONLY_FAILURE_FLAG` global is only ever set by `setTestFailureFlag()` which asserts `NODE_ENV === "test"`.

This ensures that the failure injection system is **never production-accessible** and cannot create a backdoor for attackers to disrupt payment processing.

See [Backend Failure Recovery](backend-failure-recovery.md) for documentation of the 7 failure points and how they are used in integration tests.
