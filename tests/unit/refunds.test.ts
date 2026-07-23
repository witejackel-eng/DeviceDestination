import { describe, expect, it } from "vitest";
import { refundIdempotencyKey } from "@/lib/refunds";

describe("refund idempotency", () => {
  it("produces the same key for the same input", () => {
    const a = refundIdempotencyKey({ paymentId: "p1", amountPaise: 100, actorUserId: "u1" });
    const b = refundIdempotencyKey({ paymentId: "p1", amountPaise: 100, actorUserId: "u1" });
    expect(a).toBe(b);
  });
  it("produces a different key when amount changes", () => {
    const a = refundIdempotencyKey({ paymentId: "p1", amountPaise: 100, actorUserId: "u1" });
    const b = refundIdempotencyKey({ paymentId: "p1", amountPaise: 200, actorUserId: "u1" });
    expect(a).not.toBe(b);
  });
  it("produces a different key when actor changes", () => {
    const a = refundIdempotencyKey({ paymentId: "p1", amountPaise: 100, actorUserId: "u1" });
    const b = refundIdempotencyKey({ paymentId: "p1", amountPaise: 100, actorUserId: "u2" });
    expect(a).not.toBe(b);
  });
  it("produces a different key when payment changes", () => {
    const a = refundIdempotencyKey({ paymentId: "p1", amountPaise: 100, actorUserId: "u1" });
    const b = refundIdempotencyKey({ paymentId: "p2", amountPaise: 100, actorUserId: "u1" });
    expect(a).not.toBe(b);
  });
  it("produces a 64-character hex string", () => {
    const key = refundIdempotencyKey({ paymentId: "p1", amountPaise: 100, actorUserId: "u1" });
    expect(key).toMatch(/^[a-f0-9]{64}$/);
  });
});
