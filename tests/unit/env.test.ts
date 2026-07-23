import { describe, expect, it } from "vitest";
import {
  getAdminEmails,
  isBlobConfigured,
  isCronConfigured,
  isEmailConfigured,
  isAdminEmail,
  isRazorpayConfigured,
  isRazorpayWebhookConfigured,
  isUpstashConfigured,
  isWhatsAppConfigured,
  validateEnvironment,
} from "@/lib/env";

const baseEnv = {
  NEXT_PUBLIC_SITE_URL: "https://example.com",
  DATABASE_URL: "postgresql://u:p@h:5432/db",
  BETTER_AUTH_SECRET: "secret",
  ADMIN_EMAILS: "owner@example.com, ops@example.com",
};

describe("environment validator", () => {
  it("marks required vars as ready when present", () => {
    const report = validateEnvironment({ ...baseEnv } as unknown as NodeJS.ProcessEnv);
    expect(report.blocking).toEqual([]);
    const core = report.entries.find((e) => e.name === "NEXT_PUBLIC_SITE_URL");
    expect(core?.status).toBe("ready");
  });

  it("adds missing required vars to blocking", () => {
    const report = validateEnvironment({
      ...baseEnv,
      DATABASE_URL: "",
    } as unknown as NodeJS.ProcessEnv);
    expect(report.blocking).toContain("DATABASE_URL");
  });

  it("treats missing optional channels as degraded, not blocking", () => {
    const report = validateEnvironment({ ...baseEnv } as unknown as NodeJS.ProcessEnv);
    expect(report.degraded).toContain("RESEND_API_KEY");
    expect(report.degraded).toContain("WHATSAPP_ACCESS_TOKEN");
    expect(report.degraded).toContain("BLOB_READ_WRITE_TOKEN");
    expect(report.degraded).toContain("CRON_SECRET");
    expect(report.blocking).not.toContain("RESEND_API_KEY");
  });

  it("isRazorpayConfigured is true only with both key id and secret", () => {
    expect(isRazorpayConfigured({ ...baseEnv } as unknown as NodeJS.ProcessEnv)).toBe(false);
    expect(
      isRazorpayConfigured({
        ...baseEnv,
        RAZORPAY_KEY_ID: "key",
        RAZORPAY_KEY_SECRET: "secret",
      } as unknown as NodeJS.ProcessEnv),
    ).toBe(true);
  });

  it("isRazorpayWebhookConfigured requires webhook secret", () => {
    expect(isRazorpayWebhookConfigured({ ...baseEnv } as unknown as NodeJS.ProcessEnv)).toBe(false);
    expect(
      isRazorpayWebhookConfigured({
        ...baseEnv,
        RAZORPAY_WEBHOOK_SECRET: "wh_secret",
      } as unknown as NodeJS.ProcessEnv),
    ).toBe(true);
  });

  it("isEmailConfigured requires both API key and EMAIL_FROM", () => {
    expect(isEmailConfigured({ ...baseEnv } as unknown as NodeJS.ProcessEnv)).toBe(false);
    expect(
      isEmailConfigured({
        ...baseEnv,
        RESEND_API_KEY: "k",
      } as unknown as NodeJS.ProcessEnv),
    ).toBe(false);
    expect(
      isEmailConfigured({
        ...baseEnv,
        RESEND_API_KEY: "k",
        EMAIL_FROM: "ops@example.com",
      } as unknown as NodeJS.ProcessEnv),
    ).toBe(true);
  });

  it("isWhatsAppConfigured requires token, phone id, template name, sales number", () => {
    expect(isWhatsAppConfigured({ ...baseEnv } as unknown as NodeJS.ProcessEnv)).toBe(false);
    expect(
      isWhatsAppConfigured({
        ...baseEnv,
        WHATSAPP_ACCESS_TOKEN: "t",
        WHATSAPP_PHONE_NUMBER_ID: "p",
        WHATSAPP_TEMPLATE_NAME: "tmpl",
        SALES_WHATSAPP_NUMBER: "91",
      } as unknown as NodeJS.ProcessEnv),
    ).toBe(true);
  });

  it("isUpstashConfigured requires both URL and token", () => {
    expect(isUpstashConfigured({ ...baseEnv } as unknown as NodeJS.ProcessEnv)).toBe(false);
    expect(
      isUpstashConfigured({
        ...baseEnv,
        UPSTASH_REDIS_REST_URL: "u",
        UPSTASH_REDIS_REST_TOKEN: "t",
      } as unknown as NodeJS.ProcessEnv),
    ).toBe(true);
  });

  it("isBlobConfigured requires token", () => {
    expect(isBlobConfigured({ ...baseEnv } as unknown as NodeJS.ProcessEnv)).toBe(false);
    expect(
      isBlobConfigured({ ...baseEnv, BLOB_READ_WRITE_TOKEN: "tok" } as unknown as NodeJS.ProcessEnv),
    ).toBe(true);
  });

  it("isCronConfigured requires secret", () => {
    expect(isCronConfigured({ ...baseEnv } as unknown as NodeJS.ProcessEnv)).toBe(false);
    expect(isCronConfigured({ ...baseEnv, CRON_SECRET: "s" } as unknown as NodeJS.ProcessEnv)).toBe(true);
  });

  it("getAdminEmails normalizes and trims", () => {
    const emails = getAdminEmails({
      ...baseEnv,
      ADMIN_EMAILS: " Owner@Example.com , ops@example.com,",
    } as unknown as NodeJS.ProcessEnv);
    expect(emails).toEqual(["owner@example.com", "ops@example.com"]);
  });

  it("isAdminEmail matches case-insensitively", () => {
    expect(isAdminEmail("Owner@Example.com", { ...baseEnv } as unknown as NodeJS.ProcessEnv)).toBe(true);
    expect(isAdminEmail("random@example.com", { ...baseEnv } as unknown as NodeJS.ProcessEnv)).toBe(false);
  });
});
