CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"data" jsonb NOT NULL,
	"invoices" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "invoice" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "invoice_status" text DEFAULT 'pending';