-- Phase 9: Immutable invoice model
--
-- Invoices are generated once from a snapshot of the order and business
-- settings at issue time. The PDF is stored immutably in Vercel Blob (when
-- configured) and its SHA-256 hash is recorded for integrity verification.
-- Historical invoices never change when current business settings change.
--
-- If Blob is not configured, the invoice is created with status 'deferred'
-- and the invoice-generation job is marked as configuration-deferred. The
-- invoice is NOT claimed as immutable until the PDF is stored.

CREATE TABLE IF NOT EXISTS "invoices" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "invoice_number" text NOT NULL,
  "order_id" uuid REFERENCES "orders"("id") ON DELETE RESTRICT,
  "order_number" text NOT NULL,

  -- Snapshots (immutable once written)
  "seller_snapshot" jsonb NOT NULL,
  "gstin_snapshot" text,
  "seller_address_snapshot" jsonb NOT NULL,
  "customer_billing_snapshot" jsonb NOT NULL,
  "place_of_supply_snapshot" text,
  "line_items_snapshot" jsonb NOT NULL,
  "price_gst_snapshot" jsonb NOT NULL,

  -- Totals (immutable)
  "subtotal_paise" integer NOT NULL,
  "shipping_paise" integer NOT NULL,
  "included_gst_paise" integer NOT NULL,
  "final_total_paise" integer NOT NULL,

  -- Issue metadata
  "issued_at" timestamptz NOT NULL DEFAULT now(),
  "fiscal_sequence" integer,

  -- Rendering
  "rendering_version" integer NOT NULL DEFAULT 1,
  "pdf_storage_url" text,
  "pdf_storage_key" text,
  "pdf_sha256" text,

  -- Status
  "status" text NOT NULL DEFAULT 'deferred' CHECK (
    "status" IN ('deferred', 'generated', 'failed', 'superseded')
  ),

  -- Credit-note linkage
  "credit_note_invoice_id" uuid REFERENCES "invoices"("id"),

  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- One active invoice number maps to one invoice.
CREATE UNIQUE INDEX IF NOT EXISTS "invoices_number_idx"
  ON "invoices" ("invoice_number");

-- One order has at most one non-superseded invoice.
CREATE UNIQUE INDEX IF NOT EXISTS "invoices_order_active_idx"
  ON "invoices" ("order_id")
  WHERE "status" IN ('deferred', 'generated');

-- Index for PDF hash lookup (integrity verification).
CREATE INDEX IF NOT EXISTS "invoices_pdf_hash_idx"
  ON "invoices" ("pdf_sha256")
  WHERE "pdf_sha256" IS NOT NULL;

-- Constraint: PDF hash must be present when status is 'generated'.
DO $$ BEGIN
  ALTER TABLE "invoices" ADD CONSTRAINT "invoices_generated_requires_pdf_hash"
    CHECK ("status" != 'generated' OR "pdf_sha256" IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Constraint: totals must be non-negative.
DO $$ BEGIN
  ALTER TABLE "invoices" ADD CONSTRAINT "invoices_totals_nonnegative"
    CHECK (
      "subtotal_paise" >= 0 AND
      "shipping_paise" >= 0 AND
      "included_gst_paise" >= 0 AND
      "final_total_paise" >= 0
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Constraint: included GST does not exceed final total.
DO $$ BEGIN
  ALTER TABLE "invoices" ADD CONSTRAINT "invoices_gst_does_not_exceed_total"
    CHECK ("included_gst_paise" <= "final_total_paise");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
