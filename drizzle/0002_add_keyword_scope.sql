DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'keywords'
      AND column_name = 'scope'
  ) THEN
    ALTER TABLE "keywords" ADD COLUMN "scope" text NOT NULL DEFAULT 'auto';
  END IF;
END
$$;
