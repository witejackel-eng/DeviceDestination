import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { checkoutSchema, enquirySchema } from "@/lib/validation";
import { verifyRazorpayPaymentSignature, verifyRazorpayWebhookSignature } from "@/lib/razorpay";

afterEach(() => {
  delete process.env.RAZORPAY_KEY_SECRET;
  delete process.env.RAZORPAY_WEBHOOK_SECRET;
});

describe("Razorpay signatures", () => {
  it("accepts a correct payment signature", () => {
    process.env.RAZORPAY_KEY_SECRET = "test_secret";
    const signature = createHmac("sha256", "test_secret").update("order_1|pay_1").digest("hex");
    expect(verifyRazorpayPaymentSignature("order_1", "pay_1", signature)).toBe(true);
  });
  it("rejects a modified webhook", () => {
    process.env.RAZORPAY_WEBHOOK_SECRET = "webhook_secret";
    const signature = createHmac("sha256", "webhook_secret").update("original").digest("hex");
    expect(verifyRazorpayWebhookSignature("modified", signature)).toBe(false);
  });
});

describe("server validation", () => {
  it("accepts a complete guest checkout", () =>
    expect(
      checkoutSchema.safeParse({
        name: "Aditya Sharma",
        mobile: "9876543210",
        email: "aditya@example.com",
        businessName: "",
        gstin: "",
        address: "Sector 13, Dwarka",
        city: "New Delhi",
        state: "Delhi",
        pincode: "110075",
        instructions: "",
        installationRequested: false,
        policyConsent: true,
        website: "",
      }).success,
    ).toBe(true));
  it("rejects invalid enquiry contact data", () =>
    expect(
      enquirySchema.safeParse({
        name: "A",
        email: "bad",
        mobile: "1",
        message: "short",
        type: "contact",
        website: "",
      }).success,
    ).toBe(false));
});
