# Shipping Configuration

This document explains how shipping zones, pincode rules, and the `getShippingQuote` function work, and how to configure them via the admin UI.

## Conservative defaults

The shipping engine NEVER over-promises. Out of the box:

- Unknown pincodes return `manual_confirmation` — never `serviceable`.
- COD is disabled unless a rule explicitly sets `codAvailable = true`.
- Free shipping is disabled unless a zone sets `freeShippingThresholdPaise > 0`.
- Remote-area surcharge defaults to 0.
- Estimated days are 2-5 for Delhi NCR (the only seeded zone).
- No pan-India delivery claim is made automatically.

## Schema

Two tables govern shipping:

- `shipping_zones` — a named zone (e.g. "Delhi NCR") with base delivery fee, free-shipping threshold, estimated days, COD flag, and remote surcharge.
- `shipping_pincode_rules` — pincode prefixes mapped to zones, with optional per-rule overrides for fee, estimated days, and serviceability.

## Serviceability values

Each pincode rule has one of three serviceability values:

- `serviceable` — checkout proceeds normally.
- `manual_confirmation` — checkout proceeds but the order carries the result so operations can confirm before dispatch.
- `unserviceable` — checkout is blocked with a clear error message.

## Longest-prefix matching

When a customer enters a pincode, `getShippingQuote` fetches all active rules whose `pincodePrefix` is a prefix of the entered pincode. The rule with the longest matching prefix wins. This allows:

- A broad `11` rule for "all of Delhi circle".
- A more specific `110` rule for "Delhi NCR".
- An even more specific `110075` rule for "Dwarka, New Delhi" with a different fee.

## Free shipping

Free shipping applies when:

1. The zone has `freeShippingThresholdPaise > 0`, AND
2. The order subtotal (GST-inclusive) is greater than or equal to that threshold.

If the zone has no threshold (`freeShippingThresholdPaise IS NULL`), the global `free_shipping_threshold_paise` setting is consulted. If both are 0 or null, free shipping is disabled.

## Fee composition

The final shipping fee is:

```
base_fee = rule.overrideFeePaise ?? zone.deliveryFeePaise
gross_fee = base_fee + zone.remoteAreaSurchargePaise
shipping_paise = meets_free_shipping ? 0 : gross_fee
```

## Estimated days

`estimatedDaysMin` and `estimatedDaysMax` come from the rule override if set, otherwise the zone, otherwise the defaults (2 and 5).

## Admin UI

Visit `/admin/settings/shipping` to:

- Create, list, and toggle zones.
- Create, list, and delete pincode rules.
- Assign rules to zones.

Each zone form requires:

- Name (e.g. "Delhi NCR")
- Slug (lowercase, hyphens only — used in URLs and audit logs)
- Delivery fee (paise)
- Free shipping threshold (paise, optional)
- Estimated days min/max
- COD available (rare)
- Remote area surcharge (paise)
- Active flag

Each rule form requires:

- Zone
- Pincode prefix (1-6 digits)
- Serviceability (default: `manual_confirmation`)
- Active flag

## Seed defaults

`seedDefaultShippingZones()` (call via `npm run db:seed -- --shipping`) creates:

- Zone "Delhi NCR" with slug `delhi-ncr`, delivery fee 0 paise, free-shipping threshold ₹500, estimated 2-5 days, COD disabled.
- Rules for prefixes `110`, `121`, `122`, `201`, `202` — all with `manual_confirmation` serviceability.

The business owner must explicitly upgrade these rules to `serviceable` after courier integration is live.

## Checkout integration

`/api/orders` calls `getShippingQuote` after computing the subtotal. The result is:

- Stored as `serviceabilityResult` on the order (for operations review).
- Used to compute the `shippingPaise` added to the order total.
- If `serviceability === 'unserviceable'`, checkout is blocked with HTTP 400.

The customer's `estimated_delivery_at` is set to `now + estimatedDaysMax` days for display purposes only.
