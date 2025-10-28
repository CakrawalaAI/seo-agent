import { jsonb, pgTable, text, timestamp, integer, uniqueIndex, index } from 'drizzle-orm/pg-core'

export const metricCache = pgTable(
  'metric_cache',
  {
    id: text('id').primaryKey(),
    provider: text('provider').notNull(),
    hash: text('hash').notNull(),
    projectId: text('project_id'),
    metricsJson: jsonb('metrics_json').$type<Record<string, unknown> | null>().default(null),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
    ttlSeconds: integer('ttl_seconds').notNull().default(7 * 24 * 60 * 60)
  },
  (t) => ({
    uniq: uniqueIndex('metric_cache_provider_hash_unique').on(t.provider, t.hash),
    byProject: index('idx_metric_cache_project').on(t.projectId)
  })
)
