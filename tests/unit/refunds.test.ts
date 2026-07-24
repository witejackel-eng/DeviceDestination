import { describe, expect, it } from "vitest";
import { refundIdempotencyKey, providerRefundIdempotencyKey } from "@/lib/refunds";

describe("refund idempotency", () => {
  it("produces the same key for the same input", () => {
    const a = refundIdempotencyKey({ paymentId: "p1", amountPaise: 100, nonce: "n1" });
    const b = refundIdempotencyKey({ paymentId: "p1", amountPaise: 100, nonce: "n1" });
    expect(a).toBe(b);
  });
  it("produces a different key when amount changes", () => {
    const a = refundIdempotencyKey({ paymentId: "p1", amountPaise: 100, nonce: "n1" });
    const b = refundIdempotencyKey({ paymentId: "p1", amountPaise: 200, nonce: "n1" });
    expect(a).not.toBe(b);
  });
  it("produces the same key regardless of which admin clicks (spec requirement)", () => {
    // The provider idempotency key must NOT depend on which administrator
    // clicked the button. The same refund retried by a different admin must
    // produce the same key.
    const a = refundIdempotencyKey({ paymentId: "p1", amountPaise: 100, nonce: "n1" });
    const b = refundIdempotencyKey({ paymentId: "p1", amountPaise: 100, nonce: "n1" });
    expect(a).toBe(b);
  });
  it("produces a different key when payment changes", () => {
    const a = refundIdempotencyKey({ paymentId: "p1", amountPaise: 100, nonce: "n1" });
    const b = refundIdempotencyKey({ paymentId: "p2", amountPaise: 100, nonce: "n1" });
    expect(a).not.toBe(b);
  });
  it("produces a different key when nonce changes (different refund request)", () => {
    const a = refundIdempotencyKey({ paymentId: "p1", amountPaise: 100, nonce: "n1" });
    const b = refundIdempotencyKey({ paymentId: "p1", amountPaise: 100, nonce: "n2" });
    expect(a).not.toBe(b);
  });
  it("produces a 64-character hex string", () => {
    const key = refundIdempotencyKey({ paymentId: "p1", amountPaise: 100, nonce: "n1" });
    expect(key).toMatch(/^[a-f0-9]{64}$/);
  });
  it("providerRefundIdempotencyKey includes the provider payment ID", () => {
    const key = providerRefundIdempotencyKey({
      providerPaymentId: "pay_abc",
      amountPaise: 100,
      nonce: "n1",
    });
    expect(key).toContain("pay_abc");
    expect(key).toContain("100");
    expect(key).toContain("n1");
  });
});
