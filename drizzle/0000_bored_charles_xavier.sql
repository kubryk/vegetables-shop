CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_name" text NOT NULL,
	"customer_email" text NOT NULL,
	"items" jsonb NOT NULL,
	"items_summary" text,
	"total_price" real NOT NULL,
	"currency" text NOT NULL,
	"status" text DEFAULT 'processing',
	"order_date" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"unit" text DEFAULT 'kg',
	"unit_per_cardboard" real,
	"net_weight" real,
	"price_per_unit" real NOT NULL,
	"price_per_cardboard" real,
	"currency" text DEFAULT 'UAH',
	"image" text,
	"agregation_result" real,
	"active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
