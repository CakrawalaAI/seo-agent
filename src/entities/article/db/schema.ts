import { jsonb, pgTable, text, timestamp, index } from 'drizzle-orm/pg-core'

import { projects } from '../../project/db/schema'
import { keywords } from '../../keyword/db/schema'

export const articles = pgTable('articles', {
  id: text('id').primaryKey(),
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  // Plan merge: use self-referential logical plan id (no FK)
  planItemId: text('plan_item_id'),
  // Optional link to keyword canon via project keyword
  keywordId: text('keyword_id').references(() => keywords.id, { onDelete: 'set null' }),
  // Planned publish date (YYYY-MM-DD)
  plannedDate: text('planned_date'),
  title: text('title'),
  language: text('language'),
  tone: text('tone'),
  status: text('status').notNull().default('draft'),
  outlineJson: jsonb('outline_json').$type<Array<{ heading: string; subpoints?: string[] }> | null>().default(null),
  bodyHtml: text('body_html'),
  generationDate: timestamp('generation_date', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
}, (t) => ({
  byProjectDate: index('idx_articles_project_date').on(t.projectId, t.plannedDate)
}))
