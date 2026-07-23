CREATE TYPE "public"."checkout_attempt_status" AS ENUM('initialized', 'local_order_created', 'inventory_reserved', 'provider_order_creating', 'provider_order_created', 'payment_recorded', 'ready_for_checkout', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."webhook_event_processing_status" AS ENUM('received', 'processing', 'completed', 'failed', 'ignored');--> statement-breakpoint
ALTER TYPE "public"."order_status" ADD VALUE 'inventory_exception';--> statement-breakpoint
ALTER TYPE "public"."reservation_status" ADD VALUE 'pending' BEFORE 'active';--> statement-breakpoint
ALTER TYPE "public"."reservation_status" ADD VALUE 'consuming';--> statement-breakpoint
ALTER TYPE "public"."reservation_status" ADD VALUE 'releasing';--> statement-breakpoint
ALTER TYPE "public"."reservation_status" ADD VALUE 'failed';--> statement-breakpoint
CREATE TABLE "checkout_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"idempotency_key" text NOT NULL,
	"order_id" uuid,
	"status" "checkout_attempt_status" DEFAULT 'initialized' NOT NULL,
	"provider_order_id" text,
	"last_completed_step" text,
	"last_error" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text DEFAULT 'razorpay' NOT NULL,
	"provider_event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"provider_order_id" text NOT NULL,
	"provider_payment_id" text,
	"amount_paise" integer,
	"processing_status" "webhook_event_processing_status" DEFAULT 'received' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processing_started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trigger_source" text NOT NULL,
	"jobs_claimed" integer DEFAULT 0,
	"jobs_completed" integer DEFAULT 0,
	"jobs_failed" integer DEFAULT 0,
	"reservations_expired" integer DEFAULT 0,
	"payments_reconciled" integer DEFAULT 0,
	"duration_ms" integer,
	"error" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "inventory_reservations_order_product_idx";--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "dedupe_key" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "fulfilment_hold_reason" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "capture_recorded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "order_paid_marked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "inventory_consumed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "invoice_job_queued_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "email_job_queued_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "whatsapp_job_queued_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "processing_completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "checkout_attempts" ADD CONSTRAINT "checkout_attempts_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "checkout_attempts_idempotency_key_idx" ON "checkout_attempts" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "checkout_attempts_order_id_idx" ON "checkout_attempts" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "checkout_attempts_provider_order_id_idx" ON "checkout_attempts" USING btree ("provider_order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_webhook_events_provider_event_id_idx" ON "payment_webhook_events" USING btree ("provider_event_id");--> statement-breakpoint
CREATE INDEX "payment_webhook_events_provider_order_id_idx" ON "payment_webhook_events" USING btree ("provider_order_id");--> statement-breakpoint
CREATE INDEX "payment_webhook_events_provider_payment_id_idx" ON "payment_webhook_events" USING btree ("provider_payment_id");--> statement-breakpoint
CREATE INDEX "payment_webhook_events_processing_status_idx" ON "payment_webhook_events" USING btree ("processing_status");--> statement-breakpoint
CREATE INDEX "payment_webhook_events_received_at_idx" ON "payment_webhook_events" USING btree ("received_at");--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_dedupe_key_active_idx" ON "jobs" USING btree ("dedupe_key") WHERE "jobs"."status" IN ('pending', 'processing', 'completed');