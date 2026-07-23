CREATE TYPE "public"."enquiry_status" AS ENUM('new', 'contacted', 'qualified', 'quoted', 'won', 'lost', 'closed');--> statement-breakpoint
CREATE TYPE "public"."inventory_adjustment_type" AS ENUM('receipt', 'correction', 'damage', 'return', 'reservation_correction', 'release');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('pending', 'processing', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."price_source_status" AS ENUM('verified', 'request_price', 'needs_review');--> statement-breakpoint
CREATE TYPE "public"."quote_status" AS ENUM('draft', 'sent', 'accepted', 'rejected', 'expired', 'converted');--> statement-breakpoint
CREATE TYPE "public"."reconciliation_outcome" AS ENUM('match', 'local_paid_provider_pending', 'local_pending_provider_captured', 'amount_mismatch', 'duplicate_event', 'provider_error');--> statement-breakpoint
CREATE TYPE "public"."refund_status" AS ENUM('pending', 'processing', 'processed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."reservation_status" AS ENUM('active', 'consumed', 'released', 'expired', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."shipping_serviceability" AS ENUM('serviceable', 'manual_confirmation', 'unserviceable');--> statement-breakpoint
ALTER TYPE "public"."order_status" ADD VALUE 'refund_pending' BEFORE 'refunded';--> statement-breakpoint
CREATE TABLE "inventory_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"type" "inventory_adjustment_type" NOT NULL,
	"delta" integer NOT NULL,
	"reason" text NOT NULL,
	"internal_note" text,
	"actor_user_id" text,
	"actor_email" text,
	"quantity_before" integer,
	"quantity_after" integer,
	"reserved_before" integer,
	"reserved_after" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"status" "reservation_status" DEFAULT 'active' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"released_at" timestamp with time zone,
	"release_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "job_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"run_after" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	"locked_by" text,
	"last_error" text,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_status_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"from_status" "order_status",
	"to_status" "order_status" NOT NULL,
	"actor_user_id" text,
	"actor_email" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_reconciliation_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"payment_id" uuid,
	"outcome" "reconciliation_outcome" NOT NULL,
	"local_status" text,
	"provider_status" text,
	"local_amount_paise" integer,
	"provider_amount_paise" integer,
	"notes" text,
	"actor_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_price_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"previous_price_paise" integer,
	"new_price_paise" integer,
	"gst_rate_basis_points" integer NOT NULL,
	"previous_source_status" "price_source_status",
	"new_source_status" "price_source_status",
	"verified_at" timestamp with time zone,
	"changed_by" text NOT NULL,
	"change_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quote_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid NOT NULL,
	"product_id" uuid,
	"model" text NOT NULL,
	"title" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price_incl_gst_paise" integer NOT NULL,
	"gst_rate_basis_points" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quote_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid NOT NULL,
	"from_status" "quote_status",
	"to_status" "quote_status" NOT NULL,
	"actor_user_id" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_number" text NOT NULL,
	"enquiry_id" uuid,
	"customer_name" text NOT NULL,
	"customer_email" text NOT NULL,
	"customer_mobile" text NOT NULL,
	"customer_business_name" text,
	"customer_gstin" text,
	"expiry_at" timestamp with time zone,
	"status" "quote_status" DEFAULT 'draft' NOT NULL,
	"subtotal_incl_gst_paise" integer DEFAULT 0 NOT NULL,
	"included_gst_paise" integer DEFAULT 0 NOT NULL,
	"shipping_paise" integer DEFAULT 0 NOT NULL,
	"installation_paise" integer DEFAULT 0 NOT NULL,
	"total_incl_gst_paise" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_by" text NOT NULL,
	"approved_by" text,
	"converted_order_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"provider_refund_id" text,
	"amount_paise" integer NOT NULL,
	"reason" text NOT NULL,
	"status" "refund_status" DEFAULT 'pending' NOT NULL,
	"requested_by" text NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"idempotency_key" text NOT NULL,
	"provider_response" jsonb,
	"failure_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"description" text,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipping_pincode_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"zone_id" uuid NOT NULL,
	"pincode_prefix" text NOT NULL,
	"serviceability" "shipping_serviceability" DEFAULT 'manual_confirmation' NOT NULL,
	"override_fee_paise" integer,
	"override_estimated_days_min" integer,
	"override_estimated_days_max" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipping_zones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"delivery_fee_paise" integer DEFAULT 0 NOT NULL,
	"free_shipping_threshold_paise" integer,
	"estimated_days_min" integer,
	"estimated_days_max" integer,
	"cod_available" boolean DEFAULT false NOT NULL,
	"remote_area_surcharge_paise" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "price_source_status" SET DEFAULT 'needs_review'::"public"."price_source_status";--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "price_source_status" SET DATA TYPE "public"."price_source_status" USING "price_source_status"::"public"."price_source_status";--> statement-breakpoint
ALTER TABLE "admin_audit_logs" ADD COLUMN "actor_email" text;--> statement-breakpoint
ALTER TABLE "admin_audit_logs" ADD COLUMN "metadata" jsonb;--> statement-breakpoint
ALTER TABLE "admin_audit_logs" ADD COLUMN "ip_address" text;--> statement-breakpoint
ALTER TABLE "enquiries" ADD COLUMN "status" "enquiry_status" DEFAULT 'new' NOT NULL;--> statement-breakpoint
ALTER TABLE "enquiries" ADD COLUMN "assigned_to" text;--> statement-breakpoint
ALTER TABLE "enquiries" ADD COLUMN "internal_notes" text;--> statement-breakpoint
ALTER TABLE "enquiries" ADD COLUMN "follow_up_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "enquiries" ADD COLUMN "last_contacted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "enquiries" ADD COLUMN "linked_quote_id" uuid;--> statement-breakpoint
ALTER TABLE "enquiries" ADD COLUMN "linked_order_id" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "serviceability_result" jsonb;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "courier_name" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "tracking_number" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "tracking_url" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "dispatched_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivered_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "estimated_delivery_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "fulfilment_notes" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "internal_notes" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "refund_total_paise" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "last_reconciled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "public_source_label" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "mobile" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "account_deletion_requested_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "data_export_requested_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "inventory_adjustments" ADD CONSTRAINT "inventory_adjustments_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_status_events" ADD CONSTRAINT "order_status_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_reconciliation_results" ADD CONSTRAINT "payment_reconciliation_results_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_reconciliation_results" ADD CONSTRAINT "payment_reconciliation_results_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_price_history" ADD CONSTRAINT "product_price_history_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_status_history" ADD CONSTRAINT "quote_status_history_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_enquiry_id_enquiries_id_fk" FOREIGN KEY ("enquiry_id") REFERENCES "public"."enquiries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_converted_order_id_orders_id_fk" FOREIGN KEY ("converted_order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipping_pincode_rules" ADD CONSTRAINT "shipping_pincode_rules_zone_id_shipping_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."shipping_zones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inventory_adjustments_product_idx" ON "inventory_adjustments" USING btree ("product_id","created_at");--> statement-breakpoint
CREATE INDEX "inventory_adjustments_actor_idx" ON "inventory_adjustments" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "inventory_reservations_order_idx" ON "inventory_reservations" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "inventory_reservations_product_idx" ON "inventory_reservations" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "inventory_reservations_status_idx" ON "inventory_reservations" USING btree ("status","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_reservations_order_product_idx" ON "inventory_reservations" USING btree ("order_id","product_id");--> statement-breakpoint
CREATE INDEX "jobs_status_run_after_idx" ON "jobs" USING btree ("status","run_after");--> statement-breakpoint
CREATE INDEX "jobs_type_idx" ON "jobs" USING btree ("type");--> statement-breakpoint
CREATE INDEX "jobs_locked_by_idx" ON "jobs" USING btree ("locked_by");--> statement-breakpoint
CREATE INDEX "order_status_events_order_idx" ON "order_status_events" USING btree ("order_id","created_at");--> statement-breakpoint
CREATE INDEX "reconciliation_order_idx" ON "payment_reconciliation_results" USING btree ("order_id","created_at");--> statement-breakpoint
CREATE INDEX "product_price_history_product_idx" ON "product_price_history" USING btree ("product_id","created_at");--> statement-breakpoint
CREATE INDEX "product_price_history_changed_by_idx" ON "product_price_history" USING btree ("changed_by");--> statement-breakpoint
CREATE INDEX "quote_items_quote_idx" ON "quote_items" USING btree ("quote_id");--> statement-breakpoint
CREATE INDEX "quote_status_history_quote_idx" ON "quote_status_history" USING btree ("quote_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "quotes_number_idx" ON "quotes" USING btree ("quote_number");--> statement-breakpoint
CREATE INDEX "quotes_status_idx" ON "quotes" USING btree ("status","expiry_at");--> statement-breakpoint
CREATE INDEX "quotes_enquiry_idx" ON "quotes" USING btree ("enquiry_id");--> statement-breakpoint
CREATE UNIQUE INDEX "refunds_idempotency_idx" ON "refunds" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "refunds_order_idx" ON "refunds" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "refunds_payment_idx" ON "refunds" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "refunds_status_idx" ON "refunds" USING btree ("status");--> statement-breakpoint
CREATE INDEX "shipping_pincode_rules_prefix_idx" ON "shipping_pincode_rules" USING btree ("pincode_prefix");--> statement-breakpoint
CREATE INDEX "shipping_pincode_rules_zone_idx" ON "shipping_pincode_rules" USING btree ("zone_id");--> statement-breakpoint
CREATE UNIQUE INDEX "shipping_zones_slug_idx" ON "shipping_zones" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "addresses_customer_idx" ON "addresses" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "admin_audit_logs_entity_idx" ON "admin_audit_logs" USING btree ("entity_type","entity_id","created_at");--> statement-breakpoint
CREATE INDEX "admin_audit_logs_actor_idx" ON "admin_audit_logs" USING btree ("actor_user_id","created_at");--> statement-breakpoint
CREATE INDEX "admin_audit_logs_action_idx" ON "admin_audit_logs" USING btree ("action","created_at");--> statement-breakpoint
CREATE INDEX "customers_user_idx" ON "customers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "customers_email_idx" ON "customers" USING btree ("email");--> statement-breakpoint
CREATE INDEX "enquiries_status_idx" ON "enquiries" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "enquiries_assigned_to_idx" ON "enquiries" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "orders_customer_idx" ON "orders" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "payment_status_idx" ON "payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payment_provider_payment_idx" ON "payments" USING btree ("provider_payment_id");--> statement-breakpoint
CREATE INDEX "product_documents_product_idx" ON "product_documents" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_images_product_idx" ON "product_images" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "products_status_idx" ON "products" USING btree ("status");--> statement-breakpoint
CREATE INDEX "products_stock_status_idx" ON "products" USING btree ("stock_status");--> statement-breakpoint
CREATE INDEX "products_price_source_idx" ON "products" USING btree ("price_source_status");