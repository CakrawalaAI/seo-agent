-- Ensure no duplicates remain before adding unique index on org_members
DELETE FROM org_members a
USING org_members b
WHERE a.org_id = b.org_id
  AND a.user_email = b.user_email
  AND a.ctid < b.ctid;--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "accounts_provider_account_unique" ON "accounts" USING btree ("provider","provider_account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_accounts_user" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sessions_token_unique" ON "sessions" USING btree ("token");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sessions_user" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_unique" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_verifications_identifier" ON "verifications" USING btree ("identifier");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "org_members_org_user_unique" ON "org_members" USING btree ("org_id","user_email");
