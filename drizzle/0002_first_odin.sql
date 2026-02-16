CREATE TABLE "product_metadata" (
	"id" text PRIMARY KEY NOT NULL,
	"image" text,
	"agregation_result" text DEFAULT 'cardboard',
	"position" integer DEFAULT 0,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "fakturownia_client_id" integer;