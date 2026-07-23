import { describe, expect, it } from "vitest";
import { recordAudit, redactSecrets } from "@/lib/audit";

describe("audit helper", () => {
  it("redacts known secret keys", () => {
    const input = {
      name: "test",
      password: "hunter2",
      token: "abc",
      apiKey: "xyz",
      access_token: "pwn",
      razorpay_key_secret: "live_secret",
      nested: { ok: true },
    };
    const result = redactSecrets(input);
    expect(result.name).toBe("test");
    expect(result.password).toBe("[redacted]");
    expect(result.token).toBe("[redacted]");
    expect(result.apiKey).toBe("[redacted]");
    expect(result.access_token).toBe("[redacted]");
    expect(result.razorpay_key_secret).toBe("[redacted]");
    expect(result.nested.ok).toBe(true);
  });
  it("does not redact non-secret keys", () => {
    const result = redactSecrets({ productId: "abc", price: 100, status: "paid" });
    expect(result).toEqual({ productId: "abc", price: 100, status: "paid" });
  });
  it("recordAudit does not throw when database is not configured", async () => {
    delete process.env.DATABASE_URL;
    await expect(
      recordAudit({
        actorUserId: "u1",
        action: "test_action",
        entityType: "test",
        entityId: "e1",
      }),
    ).resolves.toBeUndefined();
  });
});
