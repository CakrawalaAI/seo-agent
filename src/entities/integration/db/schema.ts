import { jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

import { projects } from '../../project/db/schema'

export const projectIntegrations = pgTable('project_integrations', {
  id: text('id').primaryKey(),
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  status: text('status').notNull().default('connected'),
  configJson: jsonb('config_json').$type<Record<string, unknown> | null>().default(null),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
})
