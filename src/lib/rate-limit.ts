import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { isUpstashConfigured } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * Rate limiting.
 *
 * Production uses Upstash Redis for distributed rate limiting across all
 * instances. In-memory fallback is per-instance only and is NOT safe for
 * multi-instance deployments — a warning is logged on every use in production.
 *
 * Endpoint-specific limits are defined in {@link RATE_LIMITS}. Each limit
 * specifies:
 *   - max requests
 *   - window (seconds)
 *   - identifier (ip, email, order, payment, etc.)
 *
 * Razorpay webhooks are NOT rate-limited here — they use signature
 * verification, body limits, and event deduplication instead.
 */

// ─── Endpoint-specific limits ─────────────────────────────────────────────

export type RateLimitIdentifier = "ip" | "email" | "order" | "payment" | "userId";

export type RateLimitConfig = {
  max: number;
  windowSeconds: number;
  identifier: RateLimitIdentifier;
};

export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  checkout: { max: 10, windowSeconds: 600, identifier: "ip" }, // 10 per 10 min per IP
  payment_verify: { max: 20, windowSeconds: 600, identifier: "ip" }, // 20 per 10 min per IP
  payment_verify_per_order: { max: 10, windowSeconds: 600, identifier: "order" }, // 10 per 10 min per order
  payment_verify_per_payment: { max: 10, windowSeconds: 600, identifier: "payment" }, // 10 per 10 min per payment
  enquiry: { max: 10, windowSeconds: 3600, identifier: "ip" }, // 10 per hour per IP
  auth: { max: 10, windowSeconds: 600, identifier: "ip" }, // 10 per 10 min per IP (login/signup)
  auth_per_email: { max: 5, windowSeconds: 600, identifier: "email" }, // 5 per 10 min per email
  password_reset: { max: 5, windowSeconds: 3600, identifier: "ip" }, // 5 per hour per IP
  password_reset_per_email: { max: 3, windowSeconds: 3600, identifier: "email" }, // 3 per hour per email
  order_token: { max: 30, windowSeconds: 600, identifier: "ip" }, // 30 per 10 min per IP
  invoice_download: { max: 20, windowSeconds: 600, identifier: "ip" }, // 20 per 10 min per IP
  admin_action: { max: 60, windowSeconds: 60, identifier: "userId" }, // 60 per min per admin user
};

// ─── Upstash client (production) ──────────────────────────────────────────

const upstashClients = new Map<string, Ratelimit>();

function getUpstashClient(config: RateLimitConfig): Ratelimit | null {
  if (!isUpstashConfigured()) return null;
  const key = `${config.max}:${config.windowSeconds}`;
  if (!upstashClients.has(key)) {
    upstashClients.set(
      key,
      new Ratelimit({
        redis: new Redis({
          url: process.env.UPSTASH_REDIS_REST_URL!,
          token: process.env.UPSTASH_REDIS_REST_TOKEN!,
        }),
        limiter: Ratelimit.slidingWindow(config.max, `${config.windowSeconds} s`),
        analytics: true,
        prefix: `devicedestination:${key}`,
      }),
    );
  }
  return upstashClients.get(key)!;
}

// ─── In-memory fallback (dev/single-instance only) ────────────────────────

const localBuckets = new Map<string, Map<string, { count: number; resetAt: number }>>();

function getLocalBucket(configKey: string): Map<string, { count: number; resetAt: number }> {
  if (!localBuckets.has(configKey)) {
    localBuckets.set(configKey, new Map());
  }
  return localBuckets.get(configKey)!;
}

function checkLocal(configKey: string, config: RateLimitConfig, identifier: string) {
  const bucket = getLocalBucket(configKey);
  const now = Date.now();
  const current = bucket.get(identifier);
  if (!current || current.resetAt < now) {
    bucket.set(identifier, { count: 1, resetAt: now + config.windowSeconds * 1000 });
    return {
      success: true,
      limit: config.max,
      remaining: config.max - 1,
      reset: now + config.windowSeconds * 1000,
    };
  }
  current.count += 1;
  return {
    success: current.count <= config.max,
    limit: config.max,
    remaining: Math.max(0, config.max - current.count),
    reset: current.resetAt,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────

export type RateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number; // epoch ms
  retryAfter?: number; // seconds until reset (for Retry-After header)
};

/**
 * Check a rate limit. Returns `{ success, limit, remaining, reset, retryAfter }`.
 *
 * In production without Upstash, logs a warning on every call — the caller
 * should not silently rely on in-memory rate limiting.
 */
export async function checkRateLimit(
  endpoint: keyof typeof RATE_LIMITS | string,
  identifier: string,
): Promise<RateLimitResult> {
  const config = RATE_LIMITS[endpoint] ?? RATE_LIMITS.auth;
  const configKey = `${endpoint}:${config.max}:${config.windowSeconds}`;

  const remote = getUpstashClient(config);
  if (remote) {
    const result = await remote.limit(identifier);
    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: Date.now() + (result.reset ?? 0),
      retryAfter: result.success ? undefined : Math.ceil((result.reset ?? 0) / 1000),
    };
  }

  // In-memory fallback.
  if (process.env.NODE_ENV === "production") {
    logger.warn(
      { event: "rate_limit_in_memory_production", endpoint, identifier },
      "Using in-memory rate limiting in production — not safe for multi-instance",
    );
  }

  const local = checkLocal(configKey, config, identifier);
  return {
    ...local,
    retryAfter: local.success ? undefined : Math.ceil((local.reset - Date.now()) / 1000),
  };
}

/**
 * Extract a trusted client IP from the request. Uses X-Forwarded-For (Vercel
 * sets this correctly) or the request's `x-real-ip` header. Falls back to
 * "unknown" if no header is present.
 */
export function getClientIP(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    // X-Forwarded-For can be a comma-separated list. The first entry is the
    // original client IP (set by the trusted proxy).
    return xff.split(",")[0].trim();
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Build rate-limit response headers. Include Retry-After when the limit is
 * exceeded, and safe metadata headers.
 */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.floor(result.reset / 1000)),
  };
  if (result.retryAfter !== undefined) {
    headers["Retry-After"] = String(result.retryAfter);
  }
  return headers;
}
