import { jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

import { projects } from '../../project/db/schema'
import { planItems } from '../../plan/db/schema'

export const articles = pgTable('articles', {
  id: text('id').primaryKey(),
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  planItemId: text('plan_item_id').references(() => planItems.id, { onDelete: 'set null' }),
  title: text('title'),
  language: text('language'),
  tone: text('tone'),
  status: text('status').notNull().default('draft'),
  outlineJson: jsonb('outline_json').$type<Array<{ heading: string; subpoints?: string[] }> | null>().default(null),
  bodyHtml: text('body_html'),
  generationDate: timestamp('generation_date', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
})
