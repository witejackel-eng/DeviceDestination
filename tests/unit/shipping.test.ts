import { describe, expect, it } from "vitest";
import { getShippingQuote, isPincodeBlocked, requiresManualConfirmation } from "@/lib/shipping";

// These tests exercise the no-database path. Database-backed rules are
// integration-tested separately.

describe("shipping engine (no-database path)", () => {
  it("rejects an invalid pincode length", async () => {
    const quote = await getShippingQuote({
      pincode: "12345",
      subtotalInclGstPaise: 100000,
      products: [{ model: "TEST", quantity: 1 }],
    });
    expect(quote.serviceable).toBe(false);
    expect(quote.serviceability).toBe("unserviceable");
    expect(quote.message).toContain("6-digit");
  });

  it("rejects non-digit pincode", async () => {
    const quote = await getShippingQuote({
      pincode: "abc123",
      subtotalInclGstPaise: 100000,
      products: [{ model: "TEST", quantity: 1 }],
    });
    expect(quote.serviceable).toBe(false);
  });

  it("returns manual_confirmation when database is not configured", async () => {
    const previous = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    try {
      const quote = await getShippingQuote({
        pincode: "110075",
        subtotalInclGstPaise: 100000,
        products: [{ model: "TEST", quantity: 1 }],
      });
      expect(quote.serviceability).toBe("manual_confirmation");
      expect(quote.requiresManualConfirmation).toBe(true);
      expect(quote.serviceable).toBe(false);
      expect(quote.shippingPaise).toBe(0);
    } finally {
      if (previous) process.env.DATABASE_URL = previous;
    }
  });

  it("isPincodeBlocked returns true for unserviceable", () => {
    expect(
      isPincodeBlocked({
        serviceable: false,
        requiresManualConfirmation: false,
        shippingPaise: 0,
        estimatedDaysMin: null,
        estimatedDaysMax: null,
        message: "",
        zoneSlug: null,
        serviceability: "unserviceable",
      }),
    ).toBe(true);
  });

  it("requiresManualConfirmation returns true for manual_confirmation", () => {
    expect(
      requiresManualConfirmation({
        serviceable: false,
        requiresManualConfirmation: true,
        shippingPaise: 0,
        estimatedDaysMin: null,
        estimatedDaysMax: null,
        message: "",
        zoneSlug: null,
        serviceability: "manual_confirmation",
      }),
    ).toBe(true);
  });
});
