import { pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'

export const keywordCanon = pgTable(
  'keyword_canon',
  {
    id: text('id').primaryKey(),
    phraseNorm: text('phrase_norm').notNull(),
    languageCode: text('language_code').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => ({
    uniq: uniqueIndex('keyword_canon_unique').on(t.phraseNorm, t.languageCode)
  })
)

