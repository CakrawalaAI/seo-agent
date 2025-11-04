import { jsonb, pgTable, text, timestamp, integer, uniqueIndex, index } from 'drizzle-orm/pg-core'

export const organizations = pgTable('organizations', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  plan: text('plan').notNull().default('starter'),
  entitlementsJson: jsonb('entitlements_json').$type<Record<string, unknown> | null>().default(null),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
})

export const organizationMembers = pgTable(
  'organization_members',
  {
    orgId: text('org_id').notNull(),
    userEmail: text('user_email').notNull(),
    role: text('role').notNull().default('member'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => ({
    uniq: uniqueIndex('organization_members_org_user_unique').on(t.orgId, t.userEmail)
  })
)
