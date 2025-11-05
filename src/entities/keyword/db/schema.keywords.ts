import { pgTable, text, integer, jsonb, timestamp, uniqueIndex, boolean } from 'drizzle-orm/pg-core'
import { websites } from '@entities/website/db/schema'

export const keywords = pgTable(
  'keywords',
  {
    id: text('id').primaryKey(),
    websiteId: text('website_id')
      .notNull()
      .references(() => websites.id, { onDelete: 'cascade' }),
    // Store normalized phrase only (lowercased, single spaces)
    phrase: text('phrase').notNull(),
    languageCode: text('language_code').notNull(),
    languageName: text('language_name').notNull(),
    locationCode: integer('location_code').notNull(),
    locationName: text('location_name').notNull(),
    provider: text('provider').notNull().default('dataforseo.labs.keyword_ideas'),
    active: boolean('active').notNull().default(false),
    starred: integer('starred').notNull().default(0),
    // metrics columns
    searchVolume: integer('search_volume'),
    cpc: text('cpc'), // keep as text to avoid decimal issues; parse in UI when needed
    competition: text('competition'),
    difficulty: integer('difficulty'),
    vol12mJson: jsonb('vol_12m_json').$type<Array<{ month: string; searchVolume: number }> | null>().default(null),
    impressionsJson: jsonb('impressions_json').$type<Record<string, unknown> | null>().default(null),
    rawJson: jsonb('raw_json').$type<Record<string, unknown> | null>().default(null),
    metricsAsOf: timestamp('metrics_as_of', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  // Unique on normalized phrase directly
  (t) => ({ uniq: uniqueIndex('uniq_keywords_geo_lang').on(t.websiteId, t.phrase, t.languageCode, t.locationCode) })
)
