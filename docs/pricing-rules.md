# Pricing rules

- Store and calculate money as integer paise.
- `sellingPriceInclGstPaise` is the final product price charged at checkout.
- Extract included GST using `gross - gross / (1 + rate)` with integer rounding; never add GST again.
- Show MRP only with official, manufacturer or authorized distributor evidence.
- A documented market reference is labelled “Typical online price”, not MRP.
- Never expose supplier landed cost or margin calculations.
- Reject a selling price above verified MRP.
- A direct-purchase price must be `verified`, have a real `priceVerifiedAt` timestamp, and remain inside `NEXT_PUBLIC_PRICE_MAX_AGE_DAYS` (30 by default).
- A stale, missing or `request-price` amount cannot enter cart or checkout; all affected interfaces route to a price-confirmation enquiry.
- Eighteen migrated tax-inclusive amounts are approved for direct purchase in the business-provided 22 July 2026 catalogue release. SF100 remains request-price because its exact local documentation and current price evidence are incomplete.
