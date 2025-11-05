import { pgTable, text, timestamp, jsonb, uniqueIndex } from 'drizzle-orm/pg-core'

export const configs = pgTable(
  'configs',
  {
    id: text('id').primaryKey(),
    scope: text('scope').notNull().default('global'),
    subjectId: text('subject_id').notNull().default('global'),
    key: text('key').notNull(),
    valueJson: jsonb('value_json').$type<Record<string, unknown> | null>().default(null),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => ({ uniqueConfig: uniqueIndex('uniq_configs_scope_subject_key').on(t.scope, t.subjectId, t.key) })
)
