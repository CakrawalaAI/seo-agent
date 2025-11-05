CREATE TABLE IF NOT EXISTS "configs" (
    "id" text PRIMARY KEY NOT NULL,
    "scope" text DEFAULT 'global' NOT NULL,
    "subject_id" text DEFAULT 'global' NOT NULL,
    "key" text NOT NULL,
    "value_json" jsonb DEFAULT 'null'::jsonb,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_configs_scope_subject_key" ON "configs" USING btree ("scope","subject_id","key");
--> statement-breakpoint
ALTER TABLE "articles" ADD COLUMN IF NOT EXISTS "target_keyword" text;
--> statement-breakpoint
UPDATE "articles"
SET "target_keyword" = COALESCE(k."phrase", "articles"."title")
FROM "keywords" k
WHERE "articles"."keyword_id" IS NOT NULL
  AND k."id" = "articles"."keyword_id"
  AND ("articles"."target_keyword" IS NULL OR "articles"."target_keyword" = '');
--> statement-breakpoint
UPDATE "articles"
SET "target_keyword" = COALESCE("target_keyword", "title")
WHERE "target_keyword" IS NULL OR "target_keyword" = '';
