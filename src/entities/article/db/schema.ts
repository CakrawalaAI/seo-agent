import { jsonb, pgTable, text, timestamp, index } from 'drizzle-orm/pg-core'
import { websites } from '../../website/db/schema'
import { keywords } from '../../keyword/db/schema.keywords'

export const articles = pgTable(
  'articles',
  {
    id: text('id').primaryKey(),
    // website_id is authoritative
    websiteId: text('website_id').references(() => websites.id, { onDelete: 'cascade' }),
    keywordId: text('keyword_id').references(() => keywords.id, { onDelete: 'set null' }),
    scheduledDate: text('scheduled_date'),
    title: text('title'),
    targetKeyword: text('target_keyword'),
    outlineJson: jsonb('outline_json').$type<Array<{ heading: string; subpoints?: string[] }> | null>().default(null),
    bodyHtml: text('body_html'),
    language: text('language'),
    tone: text('tone'),
    status: text('status').notNull().default('queued'),
    generationDate: timestamp('generation_date', { withTimezone: true }),
    publishDate: timestamp('publish_date', { withTimezone: true }),
    url: text('url'),
    payloadJson: jsonb('payload_json').$type<any | null>().default(null),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => ({ byWebsiteDate: index('idx_articles_website_date').on(t.websiteId, t.scheduledDate) })
)
