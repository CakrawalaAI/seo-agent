import { pgTable, text, timestamp, index, jsonb } from 'drizzle-orm/pg-core'

import { projects } from '../../project/db/schema'
import { keywords } from '../../keyword/db/schema'

export const planItems = pgTable(
  'plan_items',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    keywordId: text('keyword_id').references(() => keywords.id, { onDelete: 'set null' }),
    title: text('title').notNull(),
    plannedDate: text('planned_date').notNull(),
    status: text('status').notNull().default('planned'),
    outlineJson: jsonb('outline_json').$type<Array<{ heading: string; subpoints?: string[] }> | null>().default(null),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => ({
    byProjectDate: index('idx_plan_items_project_date').on(t.projectId, t.plannedDate)
  })
)
