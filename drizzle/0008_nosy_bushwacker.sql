ALTER TABLE "crawl_pages" ADD COLUMN "content_text" text;--> statement-breakpoint
ALTER TABLE "crawl_pages" ADD COLUMN "summary_json" jsonb DEFAULT 'null'::jsonb;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "site_summary_json" jsonb DEFAULT 'null'::jsonb;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "representative_urls_json" jsonb DEFAULT 'null'::jsonb;