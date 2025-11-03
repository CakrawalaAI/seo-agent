CREATE TABLE "subscription_entitlements" (
	"polar_subscription_id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"org_id" text,
	"status" text NOT NULL,
	"tier" text,
	"product_id" text,
	"price_id" text,
	"customer_id" text,
	"seat_quantity" integer,
	"current_period_end" timestamp with time zone,
	"trial_ends_at" timestamp with time zone,
	"cancel_at" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"last_synced_at" timestamp with time zone,
	"entitlements" jsonb DEFAULT 'null'::jsonb,
	"metadata" jsonb DEFAULT 'null'::jsonb,
	"raw_payload" jsonb DEFAULT 'null'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "subscription_entitlements" ADD CONSTRAINT "subscription_entitlements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_entitlements" ADD CONSTRAINT "subscription_entitlements_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "subscription_entitlements_user_unique" ON "subscription_entitlements" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "subscription_entitlements_org_idx" ON "subscription_entitlements" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "subscription_entitlements_user_idx" ON "subscription_entitlements" USING btree ("user_id");
