# Pricing rules

- Store and calculate money as integer paise.
- `sellingPriceInclGstPaise` is the final product price charged at checkout.
- Extract included GST using `gross - gross / (1 + rate)` with integer rounding; never add GST again.
- Show MRP only with official, manufacturer or authorized distributor evidence.
- A documented market reference is labelled “Typical online price”, not MRP.
- Never expose supplier landed cost or margin calculations.
- Reject a selling price above verified MRP.
- All 19 migrated prices are marked `needs-review`; they remain the old storefront’s public tax-inclusive amounts and do not show a discount.
