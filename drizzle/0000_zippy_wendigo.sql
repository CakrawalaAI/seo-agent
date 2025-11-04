CREATE TABLE "article_attachments" (
	"id" text PRIMARY KEY NOT NULL,
	"article_id" text NOT NULL,
	"type" text NOT NULL,
	"url" text NOT NULL,
	"caption" text,
	"order" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "keyword_serp" (
	"article_id" text PRIMARY KEY NOT NULL,
	"phrase" text NOT NULL,
	"language" text NOT NULL,
	"location_code" text NOT NULL,
	"device" text DEFAULT 'desktop' NOT NULL,
	"top_k" text DEFAULT '10' NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"snapshot_json" jsonb DEFAULT 'null'::jsonb
);
--> statement-breakpoint
CREATE TABLE "articles" (
	"id" text PRIMARY KEY NOT NULL,
	"website_id" text,
	"keyword_id" text,
	"scheduled_date" text,
	"title" text,
	"outline_json" jsonb DEFAULT 'null'::jsonb,
	"body_html" text,
	"language" text,
	"tone" text,
	"status" text DEFAULT 'queued' NOT NULL,
	"generation_date" timestamp with time zone,
	"publish_date" timestamp with time zone,
	"url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_auth_providers" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"expires_at" timestamp with time zone,
	"id_token" text,
	"scope" text,
	"raw_json" jsonb DEFAULT 'null'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"image" text,
	"email_verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crawl_pages" (
	"id" text PRIMARY KEY NOT NULL,
	"website_id" text NOT NULL,
	"job_id" text NOT NULL,
	"url" text NOT NULL,
	"http_status" integer,
	"title" text,
	"content" text,
	"summary" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crawl_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"website_id" text NOT NULL,
	"providers_json" jsonb DEFAULT 'null'::jsonb,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integrations" (
	"id" text PRIMARY KEY NOT NULL,
	"website_id" text NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'connected' NOT NULL,
	"config_json" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "keywords" (
	"id" text PRIMARY KEY NOT NULL,
	"website_id" text NOT NULL,
	"phrase" text NOT NULL,
	"phrase_norm" text NOT NULL,
	"language_code" text NOT NULL,
	"language_name" text NOT NULL,
	"location_code" integer NOT NULL,
	"location_name" text NOT NULL,
	"provider" text DEFAULT 'dataforseo.labs.keyword_ideas' NOT NULL,
	"include" boolean DEFAULT false NOT NULL,
	"starred" integer DEFAULT 0 NOT NULL,
	"search_volume" integer,
	"cpc" text,
	"competition" text,
	"difficulty" integer,
	"vol_12m_json" jsonb DEFAULT 'null'::jsonb,
	"impressions_json" jsonb DEFAULT 'null'::jsonb,
	"raw_json" jsonb DEFAULT 'null'::jsonb,
	"metrics_as_of" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_members" (
	"org_id" text NOT NULL,
	"user_email" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"plan" text DEFAULT 'starter' NOT NULL,
	"entitlements_json" jsonb DEFAULT 'null'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
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
CREATE TABLE "websites" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"url" text NOT NULL,
	"default_locale" text DEFAULT 'en-US' NOT NULL,
	"summary" text,
	"settings_json" jsonb DEFAULT 'null'::jsonb,
	"status" text DEFAULT 'crawled' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "article_attachments" ADD CONSTRAINT "article_attachments_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "keyword_serp" ADD CONSTRAINT "keyword_serp_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_website_id_websites_id_fk" FOREIGN KEY ("website_id") REFERENCES "public"."websites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_keyword_id_keywords_id_fk" FOREIGN KEY ("keyword_id") REFERENCES "public"."keywords"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_auth_providers" ADD CONSTRAINT "user_auth_providers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crawl_pages" ADD CONSTRAINT "crawl_pages_website_id_websites_id_fk" FOREIGN KEY ("website_id") REFERENCES "public"."websites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crawl_pages" ADD CONSTRAINT "crawl_pages_job_id_crawl_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."crawl_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crawl_jobs" ADD CONSTRAINT "crawl_jobs_website_id_websites_id_fk" FOREIGN KEY ("website_id") REFERENCES "public"."websites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_website_id_websites_id_fk" FOREIGN KEY ("website_id") REFERENCES "public"."websites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "keywords" ADD CONSTRAINT "keywords_website_id_websites_id_fk" FOREIGN KEY ("website_id") REFERENCES "public"."websites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "websites" ADD CONSTRAINT "websites_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_articles_website_date" ON "articles" USING btree ("website_id","scheduled_date");--> statement-breakpoint
CREATE UNIQUE INDEX "user_auth_providers_unique" ON "user_auth_providers" USING btree ("provider_id","provider_account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_crawl_pages_site_job" ON "crawl_pages" USING btree ("website_id","job_id");--> statement-breakpoint
CREATE INDEX "idx_crawl_pages_site_url" ON "crawl_pages" USING btree ("website_id","url");--> statement-breakpoint
CREATE INDEX "idx_crawl_jobs_site" ON "crawl_jobs" USING btree ("website_id");--> statement-breakpoint
CREATE INDEX "idx_integrations_site" ON "integrations" USING btree ("website_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_keywords_geo_lang" ON "keywords" USING btree ("website_id","phrase_norm","language_code","location_code");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_members_org_user_unique" ON "organization_members" USING btree ("org_id","user_email");--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_user_unique" ON "subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "subscriptions_org_idx" ON "subscriptions" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "subscriptions_user_idx" ON "subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_websites_org" ON "websites" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "idx_websites_url" ON "websites" USING btree ("url");