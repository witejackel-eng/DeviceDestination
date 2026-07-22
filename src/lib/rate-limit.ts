import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

let rateLimit: Ratelimit | null = null;
const local = new Map<string, { count: number; resetAt: number }>();

function getRateLimit() {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null;
  if (!rateLimit) {
    rateLimit = new Ratelimit({
      redis: new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      }),
      limiter: Ratelimit.slidingWindow(5, "10 m"),
      analytics: true,
      prefix: "devicedestination",
    });
  }
  return rateLimit;
}

export async function checkRateLimit(identifier: string) {
  const remote = getRateLimit();
  if (remote) return remote.limit(identifier);
  const now = Date.now();
  const current = local.get(identifier);
  if (!current || current.resetAt < now) {
    local.set(identifier, { count: 1, resetAt: now + 10 * 60 * 1000 });
    return { success: true, limit: 5, remaining: 4, reset: now + 10 * 60 * 1000 };
  }
  current.count += 1;
  return {
    success: current.count <= 5,
    limit: 5,
    remaining: Math.max(0, 5 - current.count),
    reset: current.resetAt,
  };
}
