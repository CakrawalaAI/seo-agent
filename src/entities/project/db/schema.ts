import { boolean, integer, pgTable, text, timestamp, index } from 'drizzle-orm/pg-core'

import { orgs } from '../../org/db/schema'

export const projects = pgTable(
  'projects',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    orgId: text('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    siteUrl: text('site_url'),
    defaultLocale: text('default_locale').notNull().default('en-US'),
    status: text('status').notNull().default('draft'),
    autoPublishPolicy: text('auto_publish_policy').default('buffered'),
    bufferDays: integer('buffer_days').default(3),
    businessSummary: text('business_summary'),
    crawlBudget: integer('crawl_budget').default(20),
    workflowState: text('workflow_state').notNull().default('pending_summary_approval'),
    discoveryApproved: boolean('discovery_approved').notNull().default(false),
    planningApproved: boolean('planning_approved').notNull().default(false),
    serpDevice: text('serp_device').default('desktop'),
    serpLocationCode: integer('serp_location_code').default(2840),
    metricsLocationCode: integer('metrics_location_code').default(2840),
    dfsLanguageCode: text('dfs_language_code').notNull().default('en'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => ({
    byOrg: index('idx_projects_org').on(t.orgId)
  })
)
