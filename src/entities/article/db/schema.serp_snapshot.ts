import { pgTable, text, timestamp, jsonb } from 'drizzle-orm/pg-core'
import { articles } from './schema'

export const articleSerpSnapshots = pgTable('article_serp_snapshots', {
  articleId: text('article_id')
    .primaryKey()
    .references(() => articles.id, { onDelete: 'cascade' }),
  phrase: text('phrase').notNull(),
  language: text('language').notNull(),
  locationCode: text('location_code').notNull(),
  device: text('device').notNull().default('desktop'),
  topK: text('top_k').notNull().default('10'),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
  snapshotJson: jsonb('snapshot_json').$type<Record<string, unknown> | null>().default(null)
})

