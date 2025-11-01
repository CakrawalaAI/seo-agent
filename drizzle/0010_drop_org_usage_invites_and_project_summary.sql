-- Drop org invites and usage tables (if exist)
DROP TABLE IF EXISTS org_invites;
DROP TABLE IF EXISTS org_usage;

-- Drop project summary columns (if exist)
ALTER TABLE projects
  DROP COLUMN IF EXISTS site_summary_json,
  DROP COLUMN IF EXISTS representative_urls_json;

