CREATE TABLE IF NOT EXISTS "project_discoveries" (
  "id" text PRIMARY KEY,
  "project_id" text NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE,
  "summary_json" jsonb,
  "seed_json" jsonb,
  "crawl_json" jsonb,
  "providers_json" jsonb,
  "seed_count" integer DEFAULT 0,
  "keyword_count" integer DEFAULT 0,
  "started_at" timestamptz,
  "completed_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_project_discoveries_project"
  ON "project_discoveries" ("project_id");
