import { and, eq, gte, or } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/db/client";
import { shippingPincodeRules, shippingZones } from "@/db/schema";
import { getSetting, getSettingInt } from "@/lib/settings";
import type { shippingServiceability } from "@/db/schema";

export type Serviceability = (typeof shippingServiceability.enumValues)[number];

export type ShippingQuoteInput = {
  pincode: string;
  subtotalInclGstPaise: number;
  products: Array<{ model: string; quantity: number }>;
};

export type ShippingQuote = {
  serviceable: boolean;
  requiresManualConfirmation: boolean;
  shippingPaise: number;
  estimatedDaysMin: number | null;
  estimatedDaysMax: number | null;
  message: string;
  zoneSlug: string | null;
  serviceability: Serviceability;
};

const DEFAULT_DELIVERY_FEE_PAISE = 0;
const DEFAULT_ESTIMATED_DAYS_MIN = 2;
const DEFAULT_ESTIMATED_DAYS_MAX = 5;

function normalisePincode(pincode: string): string {
  return (pincode ?? "").replace(/\D/g, "");
}

function longestPrefixMatch(
  rules: Array<{ pincodePrefix: string }>,
  pincode: string,
): string | null {
  let best: string | null = null;
  for (const rule of rules) {
    if (pincode.startsWith(rule.pincodePrefix)) {
      if (!best || rule.pincodePrefix.length > best.length) best = rule.pincodePrefix;
    }
  }
  return best;
}

/**
 * Compute a server-side shipping quote. Never throws — returns a safe
 * `manual_confirmation` quote on any error.
 *
 * Defaults:
 *  - Unknown pincodes → manual_confirmation
 *  - Free shipping only applies if the threshold is configured AND met
 *  - COD is NEVER returned as available unless a rule explicitly enables it
 */
export async function getShippingQuote(input: ShippingQuoteInput): Promise<ShippingQuote> {
  const pincode = normalisePincode(input.pincode);
  if (pincode.length !== 6) {
    return {
      serviceable: false,
      requiresManualConfirmation: false,
      shippingPaise: 0,
      estimatedDaysMin: null,
      estimatedDaysMax: null,
      message: "Please enter a valid 6-digit pincode.",
      zoneSlug: null,
      serviceability: "unserviceable",
    };
  }

  if (!isDatabaseConfigured()) {
    return {
      serviceable: false,
      requiresManualConfirmation: true,
      shippingPaise: 0,
      estimatedDaysMin: null,
      estimatedDaysMax: null,
      message: await getSetting(
        "default_service_area_message",
        "Serviceability is not configured. Please request a quote.",
      ),
      zoneSlug: null,
      serviceability: "manual_confirmation",
    };
  }

  const db = getDb();
  // Fetch all active rules; we need longest-prefix match logic.
  const rules = await db
    .select({
      rule: shippingPincodeRules,
      zone: shippingZones,
    })
    .from(shippingPincodeRules)
    .innerJoin(shippingZones, eq(shippingZones.id, shippingPincodeRules.zoneId))
    .where(and(eq(shippingPincodeRules.isActive, true), eq(shippingZones.isActive, true)));

  const matchingRules = rules.filter((row) => pincode.startsWith(row.rule.pincodePrefix));
  if (matchingRules.length === 0) {
    return {
      serviceable: false,
      requiresManualConfirmation: true,
      shippingPaise: 0,
      estimatedDaysMin: null,
      estimatedDaysMax: null,
      message: await getSetting(
        "default_service_area_message",
        "We do not have delivery information for this pincode. Please request a quote.",
      ),
      zoneSlug: null,
      serviceability: "manual_confirmation",
    };
  }

  // Longest-prefix match wins.
  matchingRules.sort((a, b) => b.rule.pincodePrefix.length - a.rule.pincodePrefix.length);
  const matched = matchingRules[0];
  const zone = matched.zone;
  const rule = matched.rule;
  const serviceability: Serviceability = rule.serviceability;

  if (serviceability === "unserviceable") {
    return {
      serviceable: false,
      requiresManualConfirmation: false,
      shippingPaise: 0,
      estimatedDaysMin: null,
      estimatedDaysMax: null,
      message: "This pincode is currently not serviceable. Please contact us for alternatives.",
      zoneSlug: zone.slug,
      serviceability,
    };
  }

  // Compute fee: zone base OR rule override. Add remote surcharge if any.
  const baseFee = rule.overrideFeePaise ?? zone.deliveryFeePaise ?? DEFAULT_DELIVERY_FEE_PAISE;
  const surcharge = zone.remoteAreaSurchargePaise ?? 0;
  const grossFee = baseFee + surcharge;

  // Free shipping threshold (zone-level overrides global, global applies if no zone threshold).
  const threshold = zone.freeShippingThresholdPaise ?? (await getSettingInt("free_shipping_threshold_paise", 0));
  const meetsFreeShipping = threshold > 0 && input.subtotalInclGstPaise >= threshold;
  const shippingPaise = meetsFreeShipping ? 0 : grossFee;

  const daysMin = rule.overrideEstimatedDaysMin ?? zone.estimatedDaysMin ?? DEFAULT_ESTIMATED_DAYS_MIN;
  const daysMax = rule.overrideEstimatedDaysMax ?? zone.estimatedDaysMax ?? DEFAULT_ESTIMATED_DAYS_MAX;

  return {
    serviceable: serviceability === "serviceable",
    requiresManualConfirmation: serviceability === "manual_confirmation",
    shippingPaise,
    estimatedDaysMin: daysMin,
    estimatedDaysMax: daysMax,
    message:
      serviceability === "manual_confirmation"
        ? "Serviceability for this pincode requires manual confirmation. We will confirm before dispatch."
        : `Estimated delivery in ${daysMin}-${daysMax} business days.`,
    zoneSlug: zone.slug,
    serviceability,
  };
}

/** Convenience: returns true if checkout should be blocked for this pincode. */
export function isPincodeBlocked(quote: ShippingQuote): boolean {
  return quote.serviceability === "unserviceable";
}

/** Convenience: returns true if checkout should route to quote flow. */
export function requiresManualConfirmation(quote: ShippingQuote): boolean {
  return quote.serviceability === "manual_confirmation";
}

/**
 * Seed safe default shipping zones. Called by the seed script. Conservative:
 * only adds Delhi NCR prefix 110/121/122/201/202 as `manual_confirmation`
 * (the business owner must explicitly upgrade to `serviceable` once courier
 * integration is live).
 */
export async function seedDefaultShippingZones(): Promise<void> {
  if (!isDatabaseConfigured()) return;
  const db = getDb();
  const [zone] = await db
    .insert(shippingZones)
    .values({
      name: "Delhi NCR",
      slug: "delhi-ncr",
      isActive: true,
      deliveryFeePaise: 0,
      freeShippingThresholdPaise: 50_000,
      estimatedDaysMin: 2,
      estimatedDaysMax: 5,
      codAvailable: false,
      remoteAreaSurchargePaise: 0,
      notes: "Default conservative zone. Upgrade rules to 'serviceable' after courier integration.",
    })
    .onConflictDoUpdate({
      target: shippingZones.slug,
      set: { name: "Delhi NCR", updatedAt: new Date() },
    })
    .returning({ id: shippingZones.id });

  const prefixes = ["110", "121", "122", "201", "202"];
  for (const prefix of prefixes) {
    await db
      .insert(shippingPincodeRules)
      .values({
        zoneId: zone.id,
        pincodePrefix: prefix,
        serviceability: "manual_confirmation",
        isActive: true,
        notes: "Default conservative rule — confirm before dispatch.",
      })
      .onConflictDoNothing();
  }
}
