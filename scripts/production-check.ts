#!/usr/bin/env node
/**
 * Production readiness check.
 *
 * Verifies that every critical subsystem is configured for production:
 *   - Required environment groups
 *   - Database connectivity (if DATABASE_URL is set)
 *   - Payment configuration completeness
 *   - Webhook configuration
 *   - Cron protection
 *   - Distributed rate limiting
 *   - Legal invoice identity
 *   - Canonical site URL
 *   - Storage configuration
 *   - Notification channel status
 *
 * Outputs only safe status information — never secret values.
 *
 * Exit codes:
 *   0 — all critical checks passed
 *   1 — one or more critical checks failed
 */

import { validateEnvironment, isRazorpayConfigured, isRazorpayWebhookConfigured, isEmailConfigured, isWhatsAppConfigured, isUpstashConfigured, isBlobConfigured, isCronConfigured } from "../src/lib/env";

type CheckResult = {
  name: string;
  group: string;
  status: "pass" | "fail" | "warn";
  detail: string;
};

const results: CheckResult[] = [];

function check(name: string, group: string, ok: boolean, detail: string, warnOnFail = false): void {
  results.push({
    name,
    group,
    status: ok ? "pass" : warnOnFail ? "warn" : "fail",
    detail,
  });
}

// ─── Environment variable groups ───────────────────────────────────────────

const env = validateEnvironment();
const isProduction = process.env.NODE_ENV === "production";
const isVercel = Boolean(process.env.VERCEL);

// Core
check(
  "NEXT_PUBLIC_SITE_URL",
  "core",
  Boolean(process.env.NEXT_PUBLIC_SITE_URL),
  process.env.NEXT_PUBLIC_SITE_URL
    ? `Configured: ${maskUrl(process.env.NEXT_PUBLIC_SITE_URL)}`
    : "Missing — canonical URLs will be incorrect",
);

// Reject preview/localhost origins in production.
if (isProduction && process.env.NEXT_PUBLIC_SITE_URL) {
  const url = process.env.NEXT_PUBLIC_SITE_URL.toLowerCase();
  const isPreview = url.includes("vercel.app") || url.includes("localhost") || url.includes("127.0.0.1");
  check(
    "Canonical domain is not a preview/localhost",
    "core",
    !isPreview,
    isPreview ? "Production must use a canonical domain, not a Vercel preview or localhost" : "Canonical domain is a real origin",
  );
}

// Database
check(
  "DATABASE_URL",
  "database",
  Boolean(process.env.DATABASE_URL),
  process.env.DATABASE_URL ? "Configured" : "Missing — no database connection possible",
);

// Authentication
check(
  "BETTER_AUTH_SECRET",
  "authentication",
  Boolean(process.env.BETTER_AUTH_SECRET),
  process.env.BETTER_AUTH_SECRET ? "Configured" : "Missing — authentication cannot sign sessions",
);
check(
  "BETTER_AUTH_URL",
  "authentication",
  Boolean(process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_SITE_URL),
  "Configured via BETTER_AUTH_URL or NEXT_PUBLIC_SITE_URL",
);
check(
  "ADMIN_EMAILS",
  "authentication",
  Boolean(process.env.ADMIN_EMAILS && process.env.ADMIN_EMAILS.trim().length > 0),
  process.env.ADMIN_EMAILS
    ? `Configured: ${process.env.ADMIN_EMAILS.split(",").length} admin email(s)`
    : "Missing — no admin access possible",
);

// Payments
check(
  "RAZORPAY_KEY_ID",
  "payments",
  Boolean(process.env.RAZORPAY_KEY_ID),
  process.env.RAZORPAY_KEY_ID ? "Configured" : "Missing — live checkout disabled",
);
check(
  "RAZORPAY_KEY_SECRET",
  "payments",
  Boolean(process.env.RAZORPAY_KEY_SECRET),
  process.env.RAZORPAY_KEY_SECRET ? "Configured" : "Missing — live checkout disabled",
);
check(
  "NEXT_PUBLIC_RAZORPAY_KEY_ID",
  "payments",
  Boolean(process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID),
  process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ? "Configured" : "Missing — checkout form cannot initialise",
);
check(
  "RAZORPAY_WEBHOOK_SECRET",
  "payments",
  isRazorpayWebhookConfigured(),
  isRazorpayWebhookConfigured() ? "Configured" : "Missing — webhook signature verification disabled",
);
check(
  "Razorpay fully configured",
  "payments",
  isRazorpayConfigured(),
  isRazorpayConfigured() ? "Server-side Razorpay calls active" : "Razorpay not fully configured",
);

// Cron
check(
  "CRON_SECRET",
  "jobs",
  isCronConfigured(),
  isCronConfigured() ? "Configured — cron endpoint secured" : "Missing — cron endpoint refuses to run",
);

// Rate limiting
check(
  "UPSTASH_REDIS_REST_URL",
  "rate_limit",
  Boolean(process.env.UPSTASH_REDIS_REST_URL),
  process.env.UPSTASH_REDIS_REST_URL ? "Configured" : "Missing — falling back to in-memory rate limiting",
  true, // warn, not fail — in-memory works for single-instance
);
check(
  "UPSTASH_REDIS_REST_TOKEN",
  "rate_limit",
  Boolean(process.env.UPSTASH_REDIS_REST_TOKEN),
  process.env.UPSTASH_REDIS_REST_TOKEN ? "Configured" : "Missing",
  true,
);
check(
  "Distributed rate limiting",
  "rate_limit",
  isUpstashConfigured(),
  isUpstashConfigured() ? "Distributed rate limiting active" : "In-memory only — not safe for multi-instance",
  isProduction, // warn in production, info in dev
);

// Order access (Phase 8 will add ORDER_ACCESS_SECRET)
check(
  "ORDER_ACCESS_SECRET",
  "security",
  Boolean(process.env.ORDER_ACCESS_SECRET),
  process.env.ORDER_ACCESS_SECRET ? "Configured" : "Missing — order tokens will use a derived key",
  true,
);

// Business / invoice identity
check(
  "BUSINESS_LEGAL_NAME",
  "business",
  Boolean(process.env.BUSINESS_LEGAL_NAME),
  process.env.BUSINESS_LEGAL_NAME ? "Configured" : "Missing — invoices cannot show legal seller name",
  isProduction,
);
check(
  "BUSINESS_GSTIN",
  "business",
  Boolean(process.env.BUSINESS_GSTIN),
  process.env.BUSINESS_GSTIN ? "Configured" : "Missing — invoices cannot show GSTIN",
  isProduction,
);

// Storage
check(
  "BLOB_READ_WRITE_TOKEN",
  "storage",
  isBlobConfigured(),
  isBlobConfigured() ? "Vercel Blob active" : "Missing — invoice PDFs cannot be stored immutably",
  isProduction,
);

// Notification channels
check(
  "RESEND_API_KEY + EMAIL_FROM",
  "email",
  isEmailConfigured(),
  isEmailConfigured() ? "Email channel active" : "Email channel disabled (verification emails off)",
  isProduction,
);
check(
  "WhatsApp channel",
  "whatsapp",
  isWhatsAppConfigured(),
  isWhatsAppConfigured() ? "WhatsApp channel active" : "WhatsApp channel disabled",
);

// ─── Database connectivity (if configured) ────────────────────────────────

if (process.env.DATABASE_URL) {
  try {
    const { getDb } = await import("../src/db/client");
    const { sql } = await import("drizzle-orm");
    const db = getDb();
    await db.execute(sql`SELECT 1`);
    check("Database connectivity", "database", true, "Connection successful");
  } catch (error) {
    check(
      "Database connectivity",
      "database",
      false,
      `Connection failed: ${error instanceof Error ? error.message.slice(0, 100) : "unknown"}`,
    );
  }
}

// ─── Report ────────────────────────────────────────────────────────────────

const groups = ["core", "database", "authentication", "payments", "jobs", "rate_limit", "security", "business", "storage", "email", "whatsapp"];
const fails = results.filter((r) => r.status === "fail");
const warns = results.filter((r) => r.status === "warn");

console.log("\n═══════════════════════════════════════════════════════════════");
console.log("  PRODUCTION READINESS CHECK");
console.log(`  Environment: ${process.env.NODE_ENV ?? "development"}${isVercel ? " (Vercel)" : ""}`);
console.log("═══════════════════════════════════════════════════════════════\n");

for (const group of groups) {
  const groupResults = results.filter((r) => r.group === group);
  if (groupResults.length === 0) continue;
  console.log(`── ${group.toUpperCase()} ${"─".repeat(Math.max(0, 50 - group.length))}`);
  for (const r of groupResults) {
    const icon = r.status === "pass" ? "✓" : r.status === "warn" ? "⚠" : "✗";
    console.log(`  ${icon} ${r.name}`);
    console.log(`      ${r.detail}`);
  }
  console.log();
}

console.log("═══════════════════════════════════════════════════════════════");
console.log(`  Results: ${results.length} checks, ${results.filter((r) => r.status === "pass").length} pass, ${warns.length} warn, ${fails.length} fail`);
console.log("═══════════════════════════════════════════════════════════════\n");

if (fails.length > 0) {
  console.log("Failing checks:");
  for (const f of fails) {
    console.log(`  ✗ [${f.group}] ${f.name}: ${f.detail}`);
  }
  console.log();
  process.exit(1);
}

console.log("All critical checks passed. Warnings are informational.\n");
process.exit(0);

function maskUrl(url: string): string {
  // Show the origin but not any path or query.
  try {
    const u = new URL(url);
    return u.origin;
  } catch {
    return "(invalid URL)";
  }
}
