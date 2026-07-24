import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { sendAuthEmail } from "@/lib/notifications";

function createAuth() {
  return betterAuth({
    appName: "DeviceDestination",
    secret: process.env.BETTER_AUTH_SECRET!,
    baseURL: process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_SITE_URL,
    database: drizzleAdapter(getDb(), { provider: "pg", schema, usePlural: true }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: Boolean(process.env.RESEND_API_KEY),
      minPasswordLength: 10,
      sendResetPassword: async ({ user, url }) =>
        sendAuthEmail({
          to: user.email,
          subject: "Reset your DeviceDestination password",
          text: `Use this secure link to reset your password: ${url}`,
        }),
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) =>
        sendAuthEmail({
          to: user.email,
          subject: "Verify your DeviceDestination email",
          text: `Verify your email address: ${url}`,
        }),
    },
    session: { cookieCache: { enabled: true, maxAge: 5 * 60 } },
    advanced: { useSecureCookies: process.env.NODE_ENV === "production" },
    plugins: [nextCookies()],
    user: {
      additionalFields: {
        // Expose the DB-level `role` column on `session.user.role` so the
        // admin authorization layer can consult it. Without this, better-auth
        // does not load the column and admin access is email-list-only.
        role: {
          type: "string",
          required: false,
          input: false, // never accept from client during signup/profile update
          defaultValue: "customer",
        },
        mobile: {
          type: "string",
          required: false,
          input: true,
        },
      },
    },
  });
}

let auth: ReturnType<typeof createAuth> | null = null;

export function getAuth() {
  if (!process.env.DATABASE_URL || !process.env.BETTER_AUTH_SECRET)
    throw new Error("Authentication is not configured");
  if (!auth) {
    auth = createAuth();
  }
  return auth!;
}

export function isAuthConfigured() {
  // Auth is only considered fully configured when the secret AND the admin
  // allowlist are both present. An empty ADMIN_EMAILS means no human can be
  // authorized, so we treat it as "not configured" for admin purposes —
  // callers that only need customer auth can still proceed.
  return Boolean(process.env.DATABASE_URL && process.env.BETTER_AUTH_SECRET);
}

/**
 * Whether the *admin* authorization layer has everything it needs to make a
 * positive decision. When this is false, {@link requireAdmin} /
 * {@link resolveAdmin} fail closed.
 */
export function isAuthFullyConfiguredForAdmin() {
  return Boolean(
    process.env.DATABASE_URL &&
      process.env.BETTER_AUTH_SECRET &&
      (process.env.ADMIN_EMAILS ?? "").split(",").map((s) => s.trim()).filter(Boolean).length > 0,
  );
}
