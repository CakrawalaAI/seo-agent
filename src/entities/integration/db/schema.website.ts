import { pgTable, text, timestamp, index } from 'drizzle-orm/pg-core'
import { websites } from '@entities/website/db/schema'

export const websiteIntegrations = pgTable(
  'website_integrations',
  {
    id: text('id').primaryKey(),
    websiteId: text('website_id')
      .notNull()
      .references(() => websites.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    status: text('status').notNull().default('connected'),
    configJson: text('config_json'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => ({ byWebsite: index('idx_website_integrations_site').on(t.websiteId) })
)

