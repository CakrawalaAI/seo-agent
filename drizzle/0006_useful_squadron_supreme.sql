CREATE TABLE "crawl_pages" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"url" text NOT NULL,
	"depth" integer,
	"http_status" integer,
	"status" text,
	"extracted_at" timestamp with time zone,
	"meta_json" jsonb DEFAULT 'null'::jsonb,
	"headings_json" jsonb DEFAULT 'null'::jsonb,
	"links_json" jsonb DEFAULT 'null'::jsonb,
	"content_blob_url" text,
	"content_text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "subscription_entitlements" ADD COLUMN IF NOT EXISTS "entitlements" jsonb DEFAULT 'null'::jsonb;--> statement-breakpoint
ALTER TABLE "crawl_pages" ADD CONSTRAINT "crawl_pages_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_crawl_pages_project" ON "crawl_pages" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_crawl_pages_project_url" ON "crawl_pages" USING btree ("project_id","url");
