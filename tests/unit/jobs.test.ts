import { describe, expect, it } from "vitest";
import { JOB_TYPES } from "@/lib/jobs";

describe("job runner constants", () => {
  it("includes all required job types from the spec", () => {
    const required = [
      "send-order-email",
      "send-order-whatsapp",
      "send-enquiry-email",
      "send-enquiry-whatsapp",
      "generate-invoice",
      "expire-inventory-reservation",
      "reconcile-payment",
      "send-shipment-update",
      "retry-failed-notification",
    ];
    for (const type of required) {
      expect(JOB_TYPES).toContain(type);
    }
  });
  it("does not include arbitrary job types", () => {
    expect(JOB_TYPES).not.toContain("arbitrary-action");
    expect(JOB_TYPES).not.toContain("execute-sql");
    expect(JOB_TYPES).not.toContain("run-shell");
  });
  it("has a stable length", () => {
    expect(JOB_TYPES.length).toBe(9);
  });
});
