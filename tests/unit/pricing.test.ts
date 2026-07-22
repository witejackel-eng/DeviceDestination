import { describe, expect, it } from "vitest";
import {
  calculateCartTotals,
  calculateDiscountPercent,
  extractIncludedGst,
  formatPrice,
  normalizeModel,
  normaliseSearchTerm,
  getPurchaseEligibility,
} from "@/lib/products";
import { catalogue } from "@/data/catalog";

describe("GST-safe pricing", () => {
  it("formats integer paise as INR", () => expect(formatPrice(360000)).toBe("₹3,600"));
  it("calculates the required ten percent discount", () =>
    expect(calculateDiscountPercent(360000, 400000)).toBe(10));
  it("extracts GST from a tax-inclusive price", () =>
    expect(extractIncludedGst(360000, 1800)).toBe(54915));
  it("does not add GST again in cart totals", () => {
    const product = { ...catalogue[0], sellingPriceInclGstPaise: 360000 };
    const totals = calculateCartTotals([{ product, quantity: 1 }]);
    expect(totals.grandTotalInclGstPaise).toBe(360000);
    expect(totals.includedGstPaise).toBe(54915);
  });
});

describe("model handling", () => {
  it("normalizes whitespace and case", () =>
    expect(normalizeModel(" aiFace  mars ")).toBe("AIFACE-MARS"));
  it("normalizes punctuation for model search", () =>
    expect(normaliseSearchTerm("CP UNC-DA41L3C D Q")).toBe("cpuncda41l3cdq"));
  it("requires a fresh verified price for direct purchase", () => {
    const product = { ...catalogue[0], priceVerifiedAt: "2026-07-01T00:00:00.000Z" };
    expect(
      getPurchaseEligibility(product, { now: new Date("2026-07-22"), maxAgeDays: 30 }).eligible,
    ).toBe(true);
    expect(
      getPurchaseEligibility(product, { now: new Date("2026-09-22"), maxAgeDays: 30 }),
    ).toEqual({ eligible: false, reason: "stale_price" });
  });
  it("contains no duplicate exact models or slugs", () => {
    expect(new Set(catalogue.map((product) => normalizeModel(product.model))).size).toBe(
      catalogue.length,
    );
    expect(new Set(catalogue.map((product) => product.slug)).size).toBe(catalogue.length);
  });
  it("never sells above a published MRP", () => {
    for (const product of catalogue) {
      if (product.mrpInclGstPaise && product.sellingPriceInclGstPaise)
        expect(product.sellingPriceInclGstPaise).toBeLessThanOrEqual(product.mrpInclGstPaise);
    }
  });
});
