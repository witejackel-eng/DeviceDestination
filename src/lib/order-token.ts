import { createHmac, timingSafeEqual } from "node:crypto";

function secret() {
  if (process.env.NODE_ENV === "production")
    return process.env.RAZORPAY_KEY_SECRET ?? process.env.BETTER_AUTH_SECRET ?? null;
  return process.env.RAZORPAY_KEY_SECRET ?? process.env.BETTER_AUTH_SECRET ?? "local-test-only";
}

export function createOrderConfirmationToken(orderNumber: string) {
  const value = secret();
  if (!value) throw new Error("Order confirmation secret is not configured");
  return createHmac("sha256", value).update(orderNumber).digest("hex");
}

export function verifyOrderConfirmationToken(orderNumber: string, token: string) {
  const value = secret();
  if (!value) return false;
  const expected = createHmac("sha256", value).update(orderNumber).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}
