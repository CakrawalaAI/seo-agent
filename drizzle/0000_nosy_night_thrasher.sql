CREATE TABLE "articles" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"plan_item_id" text,
	"title" text,
	"language" text,
	"tone" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"outline_json" jsonb DEFAULT 'null'::jsonb,
	"body_html" text,
	"generation_date" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "blobs" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crawl_pages" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"url" text NOT NULL,
	"depth" integer,
	"http_status" text,
	"status" text DEFAULT 'queued' NOT NULL,
	"extracted_at" timestamp with time zone,
	"meta_json" jsonb DEFAULT 'null'::jsonb,
	"headings_json" jsonb DEFAULT 'null'::jsonb,
	"links_json" jsonb DEFAULT 'null'::jsonb,
	"content_blob_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "link_graph" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"from_url" text NOT NULL,
	"to_url" text NOT NULL,
	"anchor_text" text
);
--> statement-breakpoint
CREATE TABLE "project_integrations" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'connected' NOT NULL,
	"config_json" jsonb DEFAULT 'null'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"retries" integer DEFAULT 0 NOT NULL,
	"queued_at" timestamp with time zone DEFAULT now(),
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"result_json" jsonb DEFAULT 'null'::jsonb,
	"error_json" jsonb DEFAULT 'null'::jsonb
);
--> statement-breakpoint
CREATE TABLE "keywords" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"phrase" text NOT NULL,
	"status" text DEFAULT 'recommended' NOT NULL,
	"starred" boolean DEFAULT false NOT NULL,
	"opportunity" integer,
	"metrics_json" jsonb DEFAULT 'null'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metric_cache" (
	"id" text PRIMARY KEY NOT NULL,
	"provider" text NOT NULL,
	"hash" text NOT NULL,
	"project_id" text,
	"metrics_json" jsonb DEFAULT 'null'::jsonb,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ttl_seconds" integer DEFAULT 604800 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "org_members" (
	"org_id" text NOT NULL,
	"user_email" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "org_usage" (
	"org_id" text PRIMARY KEY NOT NULL,
	"cycle_start" timestamp with time zone DEFAULT now(),
	"posts_used" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orgs" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"plan" text DEFAULT 'starter' NOT NULL,
	"entitlements_json" jsonb DEFAULT 'null'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan_items" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"keyword_id" text,
	"title" text NOT NULL,
	"planned_date" text NOT NULL,
	"status" text DEFAULT 'planned' NOT NULL,
	"outline_json" jsonb DEFAULT 'null'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"default_locale" text DEFAULT 'en-US' NOT NULL,
	"org_id" text,
	"site_url" text,
	"auto_publish_policy" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"crawl_max_depth" integer,
	"crawl_budget_pages" integer,
	"buffer_days" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_plan_item_id_plan_items_id_fk" FOREIGN KEY ("plan_item_id") REFERENCES "public"."plan_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blobs" ADD CONSTRAINT "blobs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crawl_pages" ADD CONSTRAINT "crawl_pages_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "link_graph" ADD CONSTRAINT "link_graph_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_integrations" ADD CONSTRAINT "project_integrations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "keywords" ADD CONSTRAINT "keywords_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_items" ADD CONSTRAINT "plan_items_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_items" ADD CONSTRAINT "plan_items_keyword_id_keywords_id_fk" FOREIGN KEY ("keyword_id") REFERENCES "public"."keywords"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_crawl_pages_project_url" ON "crawl_pages" USING btree ("project_id","url");--> statement-breakpoint
CREATE INDEX "idx_link_graph_project_from" ON "link_graph" USING btree ("project_id","from_url");--> statement-breakpoint
CREATE INDEX "idx_link_graph_project_to" ON "link_graph" USING btree ("project_id","to_url");--> statement-breakpoint
CREATE INDEX "idx_jobs_project_queued" ON "jobs" USING btree ("project_id","queued_at");--> statement-breakpoint
CREATE INDEX "idx_keywords_project" ON "keywords" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "metric_cache_provider_hash_unique" ON "metric_cache" USING btree ("provider","hash");--> statement-breakpoint
CREATE INDEX "idx_metric_cache_project" ON "metric_cache" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_plan_items_project_date" ON "plan_items" USING btree ("project_id","planned_date");--> statement-breakpoint
CREATE INDEX "idx_projects_org" ON "projects" USING btree ("org_id");