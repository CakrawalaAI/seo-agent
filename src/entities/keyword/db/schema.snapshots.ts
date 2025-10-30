import { jsonb, pgTable, text, timestamp, uniqueIndex, integer } from 'drizzle-orm/pg-core'
import { keywordCanon } from './schema.canon'

export const keywordMetricsSnapshot = pgTable(
  'keyword_metrics_snapshot',
  {
    id: text('id').primaryKey(),
    canonId: text('canon_id').references(() => keywordCanon.id, { onDelete: 'cascade' }).notNull(),
    provider: text('provider').notNull().default('dataforseo'),
    locationCode: integer('location_code').notNull().default(2840),
    asOfMonth: text('as_of_month').notNull(), // YYYY-MM
    metricsJson: jsonb('metrics_json').$type<Record<string, unknown> | null>().default(null),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
    ttlSeconds: integer('ttl_seconds').notNull().default(30 * 24 * 60 * 60)
  },
  (t) => ({
    uniq: uniqueIndex('kms_unique').on(t.canonId, t.provider, t.locationCode, t.asOfMonth)
  })
)

