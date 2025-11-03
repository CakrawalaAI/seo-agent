ALTER TABLE "articles" ALTER COLUMN "status" SET DEFAULT 'queued';--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "business_summary" text;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "crawl_budget" integer DEFAULT 20;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "workflow_state" text DEFAULT 'pending_summary_approval' NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "discovery_approved" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "planning_approved" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "articles" DROP COLUMN "buffer_stage";
UPDATE "projects"
SET "business_summary" = COALESCE(("project_discoveries"."summary_json"->>'businessSummary'), "business_summary")
FROM "project_discoveries"
WHERE "project_discoveries"."project_id" = "projects"."id";--> statement-breakpoint
UPDATE "articles" SET "status" = 'queued' WHERE "status" IN ('planned', 'seed', 'outline');--> statement-breakpoint
UPDATE "articles" SET "status" = 'scheduled' WHERE "status" IN ('draft', 'ready', 'generating');--> statement-breakpoint
