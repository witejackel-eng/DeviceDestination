/**
 * Typed server-side environment validator.
 *
 * Validates environment variables once at startup and provides clear grouped
 * errors. Missing optional channels are NOT fatal to unrelated functionality
 * — they only disable the channel in question.
 */

export type ChannelStatus = "ready" | "degraded" | "unconfigured";

export type EnvironmentGroup =
  | "core"
  | "database"
  | "authentication"
  | "payments"
  | "email"
  | "whatsapp"
  | "rate_limit"
  | "uploads"
  | "jobs"
  | "business";

export type EnvironmentEntry = {
  name: string;
  group: EnvironmentGroup;
  required: boolean;
  status: ChannelStatus;
  /** Public-safe reason text. Never includes the value itself. */
  reason?: string;
};

export type EnvironmentReport = {
  entries: EnvironmentEntry[];
  /** Groups that are required and missing — caller may decide to fail. */
  blocking: string[];
  /** Optional channels that are unconfigured — caller should degrade gracefully. */
  degraded: string[];
};

function statusFor(value: string | undefined, required: boolean): ChannelStatus {
  if (value && value.trim().length > 0) return "ready";
  return required ? "unconfigured" : "degraded";
}

export function validateEnvironment(env: NodeJS.ProcessEnv = process.env): EnvironmentReport {
  const entries: EnvironmentEntry[] = [
    {
      name: "NEXT_PUBLIC_SITE_URL",
      group: "core",
      required: true,
      status: statusFor(env.NEXT_PUBLIC_SITE_URL, true),
    },
    {
      name: "DATABASE_URL",
      group: "database",
      required: true,
      status: statusFor(env.DATABASE_URL, true),
    },
    {
      name: "BETTER_AUTH_SECRET",
      group: "authentication",
      required: true,
      status: statusFor(env.BETTER_AUTH_SECRET, true),
    },
    {
      name: "BETTER_AUTH_URL",
      group: "authentication",
      required: false,
      status: statusFor(env.BETTER_AUTH_URL, false),
    },
    {
      name: "ADMIN_EMAILS",
      group: "authentication",
      required: true,
      status: statusFor(env.ADMIN_EMAILS, true),
      reason: env.ADMIN_EMAILS ? undefined : "No admin emails configured — admin mutations disabled.",
    },
    {
      name: "NEXT_PUBLIC_RAZORPAY_KEY_ID",
      group: "payments",
      required: false,
      status: statusFor(env.NEXT_PUBLIC_RAZORPAY_KEY_ID, false),
    },
    {
      name: "RAZORPAY_KEY_ID",
      group: "payments",
      required: false,
      status: statusFor(env.RAZORPAY_KEY_ID, false),
    },
    {
      name: "RAZORPAY_KEY_SECRET",
      group: "payments",
      required: false,
      status: statusFor(env.RAZORPAY_KEY_SECRET, false),
    },
    {
      name: "RAZORPAY_WEBHOOK_SECRET",
      group: "payments",
      required: false,
      status: statusFor(env.RAZORPAY_WEBHOOK_SECRET, false),
      reason: env.RAZORPAY_WEBHOOK_SECRET
        ? undefined
        : "Webhook verification disabled — payment capture webhooks will be rejected in production.",
    },
    {
      name: "RESEND_API_KEY",
      group: "email",
      required: false,
      status: statusFor(env.RESEND_API_KEY, false),
    },
    {
      name: "EMAIL_FROM",
      group: "email",
      required: false,
      status: statusFor(env.EMAIL_FROM, false),
    },
    {
      name: "SALES_EMAIL",
      group: "email",
      required: false,
      status: statusFor(env.SALES_EMAIL, false),
    },
    {
      name: "WHATSAPP_ACCESS_TOKEN",
      group: "whatsapp",
      required: false,
      status: statusFor(env.WHATSAPP_ACCESS_TOKEN, false),
    },
    {
      name: "WHATSAPP_PHONE_NUMBER_ID",
      group: "whatsapp",
      required: false,
      status: statusFor(env.WHATSAPP_PHONE_NUMBER_ID, false),
    },
    {
      name: "WHATSAPP_TEMPLATE_NAME",
      group: "whatsapp",
      required: false,
      status: statusFor(env.WHATSAPP_TEMPLATE_NAME, false),
    },
    {
      name: "WHATSAPP_ORDER_TEMPLATE_NAME",
      group: "whatsapp",
      required: false,
      status: statusFor(env.WHATSAPP_ORDER_TEMPLATE_NAME, false),
    },
    {
      name: "SALES_WHATSAPP_NUMBER",
      group: "whatsapp",
      required: false,
      status: statusFor(env.SALES_WHATSAPP_NUMBER, false),
    },
    {
      name: "WHATSAPP_GRAPH_VERSION",
      group: "whatsapp",
      required: false,
      status: statusFor(env.WHATSAPP_GRAPH_VERSION, false),
    },
    {
      name: "UPSTASH_REDIS_REST_URL",
      group: "rate_limit",
      required: false,
      status: statusFor(env.UPSTASH_REDIS_REST_URL, false),
      reason: env.UPSTASH_REDIS_REST_URL
        ? undefined
        : "Falling back to in-memory rate limit (per-instance, not distributed).",
    },
    {
      name: "UPSTASH_REDIS_REST_TOKEN",
      group: "rate_limit",
      required: false,
      status: statusFor(env.UPSTASH_REDIS_REST_TOKEN, false),
    },
    {
      name: "BLOB_READ_WRITE_TOKEN",
      group: "uploads",
      required: false,
      status: statusFor(env.BLOB_READ_WRITE_TOKEN, false),
      reason: env.BLOB_READ_WRITE_TOKEN
        ? undefined
        : "Vercel Blob uploads disabled; existing asset URLs remain readable.",
    },
    {
      name: "CRON_SECRET",
      group: "jobs",
      required: false,
      status: statusFor(env.CRON_SECRET, false),
      reason: env.CRON_SECRET
        ? undefined
        : "Internal job runner endpoint disabled until CRON_SECRET is set.",
    },
    {
      name: "BUSINESS_LEGAL_NAME",
      group: "business",
      required: false,
      status: statusFor(env.BUSINESS_LEGAL_NAME, false),
    },
    {
      name: "BUSINESS_GSTIN",
      group: "business",
      required: false,
      status: statusFor(env.BUSINESS_GSTIN, false),
    },
  ];

  const blocking = entries.filter((e) => e.required && e.status !== "ready").map((e) => e.name);
  const degraded = entries
    .filter((e) => !e.required && e.status !== "ready")
    .map((e) => e.name);

  return { entries, blocking, degraded };
}

/** Convenience: is Razorpay fully configured for live server-side calls? */
export function isRazorpayConfigured(env: NodeJS.ProcessEnv = process.env) {
  return Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);
}

/** Convenience: is the webhook signature check active? */
export function isRazorpayWebhookConfigured(env: NodeJS.ProcessEnv = process.env) {
  return Boolean(env.RAZORPAY_WEBHOOK_SECRET);
}

/** Convenience: can we send transactional email? */
export function isEmailConfigured(env: NodeJS.ProcessEnv = process.env) {
  return Boolean(env.RESEND_API_KEY && env.EMAIL_FROM);
}

/** Convenience: can we send WhatsApp template messages? */
export function isWhatsAppConfigured(env: NodeJS.ProcessEnv = process.env) {
  return Boolean(
    env.WHATSAPP_ACCESS_TOKEN &&
      env.WHATSAPP_PHONE_NUMBER_ID &&
      env.WHATSAPP_TEMPLATE_NAME &&
      env.SALES_WHATSAPP_NUMBER,
  );
}

/** Convenience: is the distributed rate limiter available? */
export function isUpstashConfigured(env: NodeJS.ProcessEnv = process.env) {
  return Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN);
}

/** Convenience: are blob uploads allowed? */
export function isBlobConfigured(env: NodeJS.ProcessEnv = process.env) {
  return Boolean(env.BLOB_READ_WRITE_TOKEN);
}

/** Convenience: is the internal cron runner secured? */
export function isCronConfigured(env: NodeJS.ProcessEnv = process.env) {
  return Boolean(env.CRON_SECRET);
}

/** Normalize a comma-separated admin email list. */
export function getAdminEmails(env: NodeJS.ProcessEnv = process.env): string[] {
  return (env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string, env: NodeJS.ProcessEnv = process.env) {
  return getAdminEmails(env).includes(email.trim().toLowerCase());
}
