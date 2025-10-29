import { jsonb, pgTable, text, timestamp, integer, uniqueIndex } from 'drizzle-orm/pg-core'

export const orgs = pgTable('orgs', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  plan: text('plan').notNull().default('starter'),
  entitlementsJson: jsonb('entitlements_json').$type<Record<string, unknown> | null>().default(null),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
})

export const orgMembers = pgTable(
  'org_members',
  {
    orgId: text('org_id').notNull(),
    userEmail: text('user_email').notNull(),
    role: text('role').notNull().default('member'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => ({
    uniq: uniqueIndex('org_members_org_user_unique').on(t.orgId, t.userEmail)
  })
)

// Monthly usage tracking per organization
export const orgUsage = pgTable('org_usage', {
  orgId: text('org_id').primaryKey(),
  cycleStart: timestamp('cycle_start', { withTimezone: true }).defaultNow(),
  postsUsed: integer('posts_used').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
})
