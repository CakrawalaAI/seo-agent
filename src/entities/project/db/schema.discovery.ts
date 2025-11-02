import { pgTable, text, timestamp, jsonb, integer, index } from 'drizzle-orm/pg-core'

import { projects } from './schema'

export const projectDiscoveries = pgTable(
  'project_discoveries',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    summaryJson: jsonb('summary_json').$type<Record<string, unknown> | null>().default(null),
    seedJson: jsonb('seed_json').$type<string[] | null>().default(null),
    crawlJson: jsonb('crawl_json').$type<Record<string, unknown> | null>().default(null),
    providersJson: jsonb('providers_json').$type<string[] | null>().default(null),
    seedCount: integer('seed_count').default(0),
    keywordCount: integer('keyword_count').default(0),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => ({
    byProject: index('idx_project_discoveries_project').on(t.projectId)
  })
)
