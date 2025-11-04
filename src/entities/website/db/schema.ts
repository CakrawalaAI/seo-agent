import { pgTable, text, timestamp, index, jsonb } from 'drizzle-orm/pg-core'
import { organizations } from '../../org/db/schema'

export const websites = pgTable(
  'websites',
  {
    id: text('id').primaryKey(),
    orgId: text('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    defaultLocale: text('default_locale').notNull().default('en-US'),
    summary: text('summary'),
    seedKeywords: jsonb('seed_keywords').$type<string[] | null>().default(null),
    settingsJson: jsonb('settings_json').$type<Record<string, unknown> | null>().default(null),
    status: text('status').notNull().default('crawled'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => ({ byOrg: index('idx_websites_org').on(t.orgId), byUrl: index('idx_websites_url').on(t.url) })
)
