import { pgTable, text, timestamp, boolean, uniqueIndex, index } from 'drizzle-orm/pg-core'

import { projects } from '../../project/db/schema'
import { keywordCanon } from './schema.canon'

export const keywords = pgTable(
  'keywords',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    canonId: text('canon_id')
      .notNull()
      .references(() => keywordCanon.id, { onDelete: 'cascade' }),
    status: text('status').notNull().default('recommended'),
    starred: boolean('starred').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => ({
    byProject: index('idx_keywords_project').on(t.projectId),
    uniqProjectCanon: uniqueIndex('keywords_project_canon_unique').on(t.projectId, t.canonId)
  })
)
