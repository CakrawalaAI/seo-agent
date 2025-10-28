import { jsonb, pgTable, text, timestamp, integer, index } from 'drizzle-orm/pg-core'

import { projects } from '../../project/db/schema'

export const jobs = pgTable(
  'jobs',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    status: text('status').notNull().default('queued'),
    retries: integer('retries').notNull().default(0),
    queuedAt: timestamp('queued_at', { withTimezone: true }).defaultNow(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    resultJson: jsonb('result_json').$type<Record<string, unknown> | null>().default(null),
    errorJson: jsonb('error_json').$type<Record<string, unknown> | null>().default(null)
  },
  (t) => ({
    byProjectQueued: index('idx_jobs_project_queued').on(t.projectId, t.queuedAt)
  })
)
