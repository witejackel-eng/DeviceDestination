import { NextResponse } from "next/server";
import { and, sql } from "drizzle-orm";
import { isDatabaseConfigured, getDb } from "@/db/client";
import {
  isBlobConfigured,
  isCronConfigured,
  isEmailConfigured,
  isRazorpayConfigured,
  isRazorpayWebhookConfigured,
  isUpstashConfigured,
  isWhatsAppConfigured,
  validateEnvironment,
} from "@/lib/env";
import { brands, categories, orders, payments, products, users } from "@/db/schema";

export const dynamic = "force-dynamic";

async function checkDatabase() {
  if (!isDatabaseConfigured()) {
    return { status: "unconfigured" as const, detail: "DATABASE_URL missing" };
  }
  try {
    const db = getDb();
    // Touch one table from each major area to confirm access.
    await db.select({ count: sql<number>`count(*)` }).from(products);
    await db.select({ count: sql<number>`count(*)` }).from(orders);
    await db.select({ count: sql<number>`count(*)` }).from(payments);
    await db.select({ count: sql<number>`count(*)` }).from(users);
    await db.select({ count: sql<number>`count(*)` }).from(brands);
    await db.select({ count: sql<number>`count(*)` }).from(categories);
    return { status: "ready" as const, detail: "reachable" };
  } catch (error) {
    return {
      status: "degraded" as const,
      detail: error instanceof Error ? error.message.slice(0, 100) : "unknown_error",
    };
  }
}

export async function GET() {
  const env = validateEnvironment();
  const database = await checkDatabase();
  const response = {
    timestamp: new Date().toISOString(),
    database,
    razorpay: isRazorpayConfigured() ? "ready" : "unconfigured",
    razorpayWebhook: isRazorpayWebhookConfigured() ? "ready" : "unconfigured",
    email: isEmailConfigured() ? "ready" : "unconfigured",
    whatsapp: isWhatsAppConfigured() ? "ready" : "unconfigured",
    upstash: isUpstashConfigured() ? "ready" : "degraded",
    blob: isBlobConfigured() ? "ready" : "unconfigured",
    cron: isCronConfigured() ? "ready" : "unconfigured",
    auth: process.env.BETTER_AUTH_SECRET ? "ready" : "unconfigured",
    blocking: env.blocking,
    degraded: env.degraded,
  };
  // Never include secret values, full database URLs, or provider IDs.
  return NextResponse.json(response);
}
