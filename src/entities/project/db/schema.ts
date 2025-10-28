import { pgTable, text, timestamp, index, integer } from 'drizzle-orm/pg-core'

export const projects = pgTable(
  'projects',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    defaultLocale: text('default_locale').notNull().default('en-US'),
    orgId: text('org_id'),
    siteUrl: text('site_url'),
    autoPublishPolicy: text('auto_publish_policy'),
    status: text('status').notNull().default('draft'),
    crawlMaxDepth: integer('crawl_max_depth'),
    crawlBudgetPages: integer('crawl_budget_pages'),
    bufferDays: integer('buffer_days'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => ({
    byOrg: index('idx_projects_org').on(t.orgId)
  })
)
