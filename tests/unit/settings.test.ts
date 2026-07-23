import { describe, expect, it } from "vitest";
import { SETTING_DEFAULTS, SETTING_VALIDATORS } from "@/lib/settings";

describe("settings defaults", () => {
  it("provides conservative defaults for free shipping (0 = disabled)", () => {
    expect(SETTING_DEFAULTS.free_shipping_threshold_paise).toBe("0");
  });
  it("provides a non-zero reservation duration", () => {
    expect(Number(SETTING_DEFAULTS.default_reservation_minutes)).toBeGreaterThan(0);
  });
  it("provides a low-stock threshold that is a positive integer", () => {
    expect(Number(SETTING_DEFAULTS.low_stock_threshold)).toBeGreaterThan(0);
  });
  it("provides a quote validity of at least 1 day", () => {
    expect(Number(SETTING_DEFAULTS.quote_validity_days)).toBeGreaterThanOrEqual(1);
  });
  it("caps addresses per user at a reasonable maximum", () => {
    expect(Number(SETTING_DEFAULTS.max_addresses_per_user)).toBeLessThanOrEqual(50);
  });
  it("provides a cancellation window", () => {
    expect(Number(SETTING_DEFAULTS.cancellation_window_hours)).toBeGreaterThanOrEqual(0);
  });
});

describe("settings validators", () => {
  it("rejects negative reservation minutes", () => {
    expect(SETTING_VALIDATORS.default_reservation_minutes?.("0")).toBe(false);
    expect(SETTING_VALIDATORS.default_reservation_minutes?.("-5")).toBe(false);
    expect(SETTING_VALIDATORS.default_reservation_minutes?.("15")).toBe(true);
  });
  it("rejects absurdly large image sizes", () => {
    expect(SETTING_VALIDATORS.max_image_size_bytes?.("100")).toBe(false);
    expect(SETTING_VALIDATORS.max_image_size_bytes?.("99999999999")).toBe(false);
    expect(SETTING_VALIDATORS.max_image_size_bytes?.("8388608")).toBe(true);
  });
  it("rejects invalid quote validity days", () => {
    expect(SETTING_VALIDATORS.quote_validity_days?.("0")).toBe(false);
    expect(SETTING_VALIDATORS.quote_validity_days?.("100")).toBe(false);
    expect(SETTING_VALIDATORS.quote_validity_days?.("7")).toBe(true);
  });
  it("rejects non-numeric free shipping threshold", () => {
    expect(SETTING_VALIDATORS.free_shipping_threshold_paise?.("abc")).toBe(false);
    expect(SETTING_VALIDATORS.free_shipping_threshold_paise?.("50000")).toBe(true);
  });
  it("rejects max_addresses_per_user outside 1-50", () => {
    expect(SETTING_VALIDATORS.max_addresses_per_user?.("0")).toBe(false);
    expect(SETTING_VALIDATORS.max_addresses_per_user?.("100")).toBe(false);
    expect(SETTING_VALIDATORS.max_addresses_per_user?.("10")).toBe(true);
  });
});
