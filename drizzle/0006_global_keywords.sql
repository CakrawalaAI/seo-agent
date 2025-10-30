-- keyword canon (global)
CREATE TABLE IF NOT EXISTS "keyword_canon" (
  "id" text PRIMARY KEY NOT NULL,
  "phrase_norm" text NOT NULL,
  "language_code" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "keyword_canon_unique" ON "keyword_canon" ("phrase_norm","language_code");

-- per-project keywords: add canon_id
ALTER TABLE "keywords" ADD COLUMN IF NOT EXISTS "canon_id" text;
CREATE INDEX IF NOT EXISTS "idx_keywords_project_canon" ON "keywords" ("project_id","canon_id");

-- monthly keyword metrics (global slices)
CREATE TABLE IF NOT EXISTS "keyword_metrics_snapshot" (
  "id" text PRIMARY KEY NOT NULL,
  "canon_id" text NOT NULL REFERENCES "keyword_canon"("id") ON DELETE CASCADE,
  "provider" text NOT NULL DEFAULT 'dataforseo',
  "location_code" integer NOT NULL DEFAULT 2840,
  "as_of_month" text NOT NULL,
  "metrics_json" jsonb DEFAULT 'null'::jsonb,
  "fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
  "ttl_seconds" integer NOT NULL DEFAULT 2592000
);
CREATE UNIQUE INDEX IF NOT EXISTS "kms_unique" ON "keyword_metrics_snapshot" ("canon_id","provider","location_code","as_of_month");

-- serp snapshots (global slices)
CREATE TABLE IF NOT EXISTS "serp_snapshot" (
  "id" text PRIMARY KEY NOT NULL,
  "canon_id" text NOT NULL REFERENCES "keyword_canon"("id") ON DELETE CASCADE,
  "engine" text NOT NULL DEFAULT 'google',
  "location_code" integer NOT NULL DEFAULT 2840,
  "device" text NOT NULL DEFAULT 'desktop',
  "top_k" integer NOT NULL DEFAULT 10,
  "fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
  "items_json" jsonb DEFAULT 'null'::jsonb,
  "text_dump" text,
  "anchor_month" text
);
CREATE UNIQUE INDEX IF NOT EXISTS "serp_latest_key" ON "serp_snapshot" ("canon_id","engine","location_code","device","top_k");

-- project defaults for SERP/metrics
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "serp_device" text;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "serp_location_code" integer;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "metrics_location_code" integer;
