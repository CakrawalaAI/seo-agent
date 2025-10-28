import { pgTable, text } from 'drizzle-orm/pg-core'
import { projects } from '../../project/db/schema'

export const blobs = pgTable('blobs', {
  id: text('id').primaryKey(),
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' })
})

