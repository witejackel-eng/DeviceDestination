import Razorpay from "razorpay";
import { createHmac, timingSafeEqual } from "node:crypto";

let razorpay: Razorpay | null = null;

export function getRazorpay() {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET)
    throw new Error("Razorpay is not configured");
  if (!razorpay)
    razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  return razorpay;
}

export function verifyRazorpayPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string,
) {
  if (!process.env.RAZORPAY_KEY_SECRET) return false;
  const expected = createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function verifyRazorpayWebhookSignature(payload: string, signature: string) {
  if (!process.env.RAZORPAY_WEBHOOK_SECRET) return false;
  const expected = createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(payload)
    .digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function validateRazorpayPaymentRecord(input: {
  expectedOrderId: string;
  expectedAmountPaise: number;
  providerOrderId: string | null | undefined;
  providerAmountPaise: number;
  providerStatus: string;
}) {
  return (
    input.providerOrderId === input.expectedOrderId &&
    input.providerAmountPaise === input.expectedAmountPaise &&
    ["authorized", "captured"].includes(input.providerStatus)
  );
}
