CREATE TABLE IF NOT EXISTS "org_invites" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"email" text,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_org_invites_org" ON "org_invites" USING btree ("org_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "org_invites_token_unique" ON "org_invites" USING btree ("token");
