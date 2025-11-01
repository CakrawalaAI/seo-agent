import { integer, pgTable, text, timestamp, index } from 'drizzle-orm/pg-core'

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
    serpDevice: text('serp_device').default('desktop'),
    serpLocationCode: integer('serp_location_code').default(2840),
    metricsLocationCode: integer('metrics_location_code').default(2840),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => ({
    byOrg: index('idx_projects_org').on(t.orgId)
  })
)
