import { jsonb, pgTable, text, timestamp, index, boolean, integer } from 'drizzle-orm/pg-core'

import { projects } from '../../project/db/schema'

export const keywords = pgTable(
  'keywords',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    phrase: text('phrase').notNull(),
    status: text('status').notNull().default('recommended'),
    starred: boolean('starred').notNull().default(false),
    opportunity: integer('opportunity'),
    metricsJson: jsonb('metrics_json').$type<Record<string, unknown> | null>().default(null),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => ({
    byProject: index('idx_keywords_project').on(t.projectId)
  })
)
