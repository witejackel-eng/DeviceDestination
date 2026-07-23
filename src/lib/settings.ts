import { eq } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/db/client";
import { settings } from "@/db/schema";
import { logger } from "@/lib/logger";

/**
 * Database-backed private settings layer for non-secret operational settings.
 * Secrets MUST remain environment variables.
 *
 * Defaults are conservative — they never over-promise delivery, never auto-
 * enable COD, and never silently extend price freshness.
 */

export const SETTING_DEFAULTS: Record<string, string> = {
  free_shipping_threshold_paise: "0",
  default_reservation_minutes: "15",
  low_stock_threshold: "3",
  quote_validity_days: "7",
  order_support_email: "manish@insight-solutions.in",
  business_display_name: "DeviceDestination",
  invoice_prefix: "INV",
  quote_prefix: "QUO",
  default_service_area_message:
    "We currently deliver across Delhi NCR. For other pincodes, please request a quote and we will confirm serviceability.",
  default_delivery_fee_paise: "0",
  default_estimated_days_min: "2",
  default_estimated_days_max: "5",
  max_image_size_bytes: String(8 * 1024 * 1024),
  max_document_size_bytes: String(20 * 1024 * 1024),
  max_addresses_per_user: "10",
  cancellation_window_hours: "24",
  default_courier_name: "",
};

export const SETTING_VALIDATORS: Record<string, (value: string) => boolean> = {
  free_shipping_threshold_paise: (v) => /^\d+$/.test(v) && Number(v) >= 0,
  default_reservation_minutes: (v) => /^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 1440,
  low_stock_threshold: (v) => /^\d+$/.test(v) && Number(v) >= 0,
  quote_validity_days: (v) => /^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 90,
  max_image_size_bytes: (v) => /^\d+$/.test(v) && Number(v) >= 1024 && Number(v) <= 50 * 1024 * 1024,
  max_document_size_bytes: (v) => /^\d+$/.test(v) && Number(v) >= 1024 && Number(v) <= 50 * 1024 * 1024,
  max_addresses_per_user: (v) => /^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 50,
  cancellation_window_hours: (v) => /^\d+$/.test(v) && Number(v) >= 0 && Number(v) <= 720,
  default_delivery_fee_paise: (v) => /^\d+$/.test(v) && Number(v) >= 0,
  default_estimated_days_min: (v) => /^\d+$/.test(v) && Number(v) >= 0,
  default_estimated_days_max: (v) => /^\d+$/.test(v) && Number(v) >= 0,
};

/**
 * Get a setting value, falling back to the conservative default if the
 * database is unreachable or the key is missing. Never throws.
 */
export async function getSetting(key: string, fallback?: string): Promise<string> {
  const defaultValue = fallback ?? SETTING_DEFAULTS[key];
  if (!isDatabaseConfigured()) return defaultValue ?? "";
  try {
    const [row] = await getDb()
      .select({ value: settings.value })
      .from(settings)
      .where(eq(settings.key, key))
      .limit(1);
    return row?.value ?? defaultValue ?? "";
  } catch (error) {
    logger.warn(
      { event: "setting_fetch_failed", key, error: error instanceof Error ? error.message : "unknown" },
      "Setting fetch failed — using default",
    );
    return defaultValue ?? "";
  }
}

/** Convenience: get a setting as an integer. */
export async function getSettingInt(key: string, fallback = 0): Promise<number> {
  const raw = await getSetting(key);
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Convenience: get a setting as a boolean (only "true" → true). */
export async function getSettingBool(key: string): Promise<boolean> {
  return (await getSetting(key)).toLowerCase() === "true";
}

/**
 * Update a setting. Validates the value before persisting. Records the actor
 * for audit. Throws on invalid value.
 */
export async function setSetting(input: {
  key: string;
  value: string;
  updatedBy: string;
  description?: string;
}): Promise<void> {
  if (!isDatabaseConfigured()) {
    throw new Error("Database is not configured.");
  }
  const validator = SETTING_VALIDATORS[input.key];
  if (validator && !validator(input.value)) {
    throw new Error(`Invalid value for setting ${input.key}`);
  }
  await getDb()
    .insert(settings)
    .values({
      key: input.key,
      value: input.value,
      description: input.description,
      updatedBy: input.updatedBy,
    })
    .onConflictDoUpdate({
      target: settings.key,
      set: {
        value: input.value,
        description: input.description,
        updatedBy: input.updatedBy,
        updatedAt: new Date(),
      },
    });
}

/** List all settings with their current values and defaults merged in. */
export async function listSettings(): Promise<Array<{ key: string; value: string; description: string | null; updatedBy: string | null; updatedAt: Date | null }>> {
  if (!isDatabaseConfigured()) {
    return Object.entries(SETTING_DEFAULTS).map(([key, value]) => ({
      key,
      value,
      description: null,
      updatedBy: null,
      updatedAt: null,
    }));
  }
  const rows = await getDb().select().from(settings);
  const byKey = new Map(rows.map((row) => [row.key, row]));
  return Object.entries(SETTING_DEFAULTS).map(([key, defaultValue]) => {
    const stored = byKey.get(key);
    return {
      key,
      value: stored?.value ?? defaultValue,
      description: stored?.description ?? null,
      updatedBy: stored?.updatedBy ?? null,
      updatedAt: stored?.updatedAt ?? null,
    };
  });
}
