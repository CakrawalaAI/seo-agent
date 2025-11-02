DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'projects'
      AND column_name = 'dfs_language_code'
  ) THEN
    ALTER TABLE "projects" ADD COLUMN "dfs_language_code" text NOT NULL DEFAULT 'en';
  END IF;
END
$$;
