-- Merge plan into articles: add planned_date, keyword_id; drop FK on plan_item_id; drop plan_items table

-- Add columns if not exist
ALTER TABLE articles
  ADD COLUMN IF NOT EXISTS planned_date text,
  ADD COLUMN IF NOT EXISTS keyword_id text;

-- Drop foreign key constraint on articles.plan_item_id if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_name = 'articles'
      AND tc.constraint_name LIKE '%plan_item_id%'
  ) THEN
    EXECUTE (
      SELECT 'ALTER TABLE articles DROP CONSTRAINT ' || quote_ident(tc.constraint_name)
      FROM information_schema.table_constraints tc
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name = 'articles'
        AND tc.constraint_name LIKE '%plan_item_id%'
      LIMIT 1
    );
  END IF;
END $$;

-- Drop plan_items table if exists
DROP TABLE IF EXISTS plan_items;

