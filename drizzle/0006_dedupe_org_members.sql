-- Remove duplicate org_members before creating unique index
-- Keep one row per (org_id, user_email)
DELETE FROM org_members a
USING org_members b
WHERE a.org_id = b.org_id
  AND a.user_email = b.user_email
  AND a.ctid < b.ctid;

