import { jsonb, pgTable, text, timestamp, integer, uniqueIndex } from 'drizzle-orm/pg-core'

import { keywordCanon } from '../../keyword/db/schema.canon'

export const metricCache = pgTable(
  'metric_cache',
  {
    id: text('id').primaryKey(),
    canonId: text('canon_id')
      .notNull()
      .references(() => keywordCanon.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    metricsJson: jsonb('metrics_json').$type<Record<string, unknown> | null>().default(null),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
    ttlSeconds: integer('ttl_seconds').notNull().default(30 * 24 * 60 * 60)
  },
  (t) => ({
    uniqCanon: uniqueIndex('metric_cache_canon_unique').on(t.canonId)
  })
)
