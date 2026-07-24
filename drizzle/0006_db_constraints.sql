-- Phase 10: Database constraints for financial and inventory invariants
--
-- Enforces invariants at the database level so they cannot be violated even
-- by a bug in TypeScript or Zod validation. These complement (not replace)
-- the application-level validation.
--
-- Invariants:
--   - Quantities are positive (order_items, inventory_reservations)
--   - Prices are non-negative (products, order_items)
--   - Shipping is non-negative (orders)
--   - Tax values are non-negative (orders, products)
--   - Included GST does not exceed total (orders)
--   - Refund amounts are positive (refunds)
--   - Job attempts are non-negative, max attempts are positive
--   - Order total equals subtotal + shipping (orders)
--   - Provider payment IDs are unique when non-null (payments) [already indexed]
--   - Reservation expiry is after reservation creation (inventory_reservations)

-- ─── Order items ───────────────────────────────────────────────────────────

DO $$ BEGIN
  ALTER TABLE "order_items" ADD CONSTRAINT "order_items_quantity_positive"
    CHECK ("quantity" > 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "order_items" ADD CONSTRAINT "order_items_unit_price_nonnegative"
    CHECK ("unit_price_incl_gst_paise" >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "order_items" ADD CONSTRAINT "order_items_gst_rate_nonnegative"
    CHECK ("gst_rate_basis_points" >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── Orders ────────────────────────────────────────────────────────────────

DO $$ BEGIN
  ALTER TABLE "orders" ADD CONSTRAINT "orders_subtotal_nonnegative"
    CHECK ("subtotal_incl_gst_paise" >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "orders" ADD CONSTRAINT "orders_shipping_nonnegative"
    CHECK ("shipping_paise" >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "orders" ADD CONSTRAINT "orders_included_gst_nonnegative"
    CHECK ("included_gst_paise" >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "orders" ADD CONSTRAINT "orders_total_equals_components"
    CHECK ("total_incl_gst_paise" = "subtotal_incl_gst_paise" + "shipping_paise");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "orders" ADD CONSTRAINT "orders_included_gst_does_not_exceed_total"
    CHECK ("included_gst_paise" <= "total_incl_gst_paise");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "orders" ADD CONSTRAINT "orders_refund_total_nonnegative"
    CHECK ("refund_total_paise" IS NULL OR "refund_total_paise" >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── Products ──────────────────────────────────────────────────────────────

DO $$ BEGIN
  ALTER TABLE "products" ADD CONSTRAINT "products_selling_price_nonnegative"
    CHECK ("selling_price_incl_gst_paise" IS NULL OR "selling_price_incl_gst_paise" >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "products" ADD CONSTRAINT "products_mrp_nonnegative"
    CHECK ("mrp_incl_gst_paise" IS NULL OR "mrp_incl_gst_paise" >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "products" ADD CONSTRAINT "products_gst_rate_nonnegative"
    CHECK ("gst_rate_basis_points" >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── Payments ──────────────────────────────────────────────────────────────

DO $$ BEGIN
  ALTER TABLE "payments" ADD CONSTRAINT "payments_amount_positive"
    CHECK ("amount_paise" > 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── Refunds ───────────────────────────────────────────────────────────────

DO $$ BEGIN
  ALTER TABLE "refunds" ADD CONSTRAINT "refunds_amount_positive"
    CHECK ("amount_paise" > 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── Jobs ──────────────────────────────────────────────────────────────────

DO $$ BEGIN
  ALTER TABLE "jobs" ADD CONSTRAINT "jobs_attempts_nonnegative"
    CHECK ("attempts" >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "jobs" ADD CONSTRAINT "jobs_max_attempts_positive"
    CHECK ("max_attempts" > 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── Inventory reservations ────────────────────────────────────────────────
-- (quantity > 0 already added in migration 0004)

DO $$ BEGIN
  ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_expiry_after_creation"
    CHECK ("expires_at" > "created_at");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── Webhook events ────────────────────────────────────────────────────────

DO $$ BEGIN
  ALTER TABLE "payment_webhook_events" ADD CONSTRAINT "payment_webhook_events_attempts_nonnegative"
    CHECK ("attempts" >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── Checkout attempts ─────────────────────────────────────────────────────

DO $$ BEGIN
  ALTER TABLE "checkout_attempts" ADD CONSTRAINT "checkout_attempts_attempts_nonnegative"
    CHECK ("attempts" >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
