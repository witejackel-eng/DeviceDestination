import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { getDb } from "@/db/client";
import * as schema from "@/db/schema";
import { sendAuthEmail } from "@/lib/notifications";

export function isGoogleAuthConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function createAuth() {
  return betterAuth({
    appName: "DeviceDestination",
    secret: process.env.BETTER_AUTH_SECRET!,
    baseURL: process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_SITE_URL,
    database: drizzleAdapter(getDb(), { provider: "pg", schema, usePlural: true }),
    trustedOrigins: [process.env.BETTER_AUTH_URL, process.env.NEXT_PUBLIC_SITE_URL].filter(
      (origin): origin is string => Boolean(origin),
    ),
    // `role` is server-owned. It is readable in the session so layouts can branch
    // without a second query, but never writable by the client.
    user: {
      additionalFields: {
        role: { type: "string", required: false, defaultValue: "customer", input: false },
      },
    },
    socialProviders: isGoogleAuthConfigured()
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          },
        }
      : undefined,
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
  return Boolean(process.env.DATABASE_URL && process.env.BETTER_AUTH_SECRET);
}
