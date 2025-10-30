import { jsonb, pgTable, text, timestamp, uniqueIndex, integer } from 'drizzle-orm/pg-core'
import { keywordCanon } from '@entities/keyword/db/schema.canon'

export const serpSnapshot = pgTable(
  'serp_snapshot',
  {
    id: text('id').primaryKey(),
    canonId: text('canon_id').references(() => keywordCanon.id, { onDelete: 'cascade' }).notNull(),
    engine: text('engine').notNull().default('google'),
    locationCode: integer('location_code').notNull().default(2840),
    device: text('device').notNull().default('desktop'),
    topK: integer('top_k').notNull().default(10),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
    itemsJson: jsonb('items_json').$type<Array<Record<string, unknown>> | null>().default(null),
    textDump: text('text_dump'),
    anchorMonth: text('anchor_month') // YYYY-MM optional
  },
  (t) => ({
    latestKey: uniqueIndex('serp_latest_key').on(t.canonId, t.engine, t.locationCode, t.device, t.topK)
  })
)

