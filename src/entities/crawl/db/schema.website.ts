import { pgTable, text, jsonb, timestamp, integer, index } from 'drizzle-orm/pg-core'
import { websites } from '@entities/website/db/schema'

export const crawlRuns = pgTable(
  'crawl_runs',
  {
    id: text('id').primaryKey(),
    websiteId: text('website_id')
      .notNull()
      .references(() => websites.id, { onDelete: 'cascade' }),
    providersJson: jsonb('providers_json').$type<string[] | null>().default(null),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => ({ byWebsite: index('idx_crawl_runs_site').on(t.websiteId) })
)

export const crawlPages = pgTable(
  'crawl_pages',
  {
    id: text('id').primaryKey(),
    websiteId: text('website_id')
      .notNull()
      .references(() => websites.id, { onDelete: 'cascade' }),
    runId: text('run_id')
      .notNull()
      .references(() => crawlRuns.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    httpStatus: integer('http_status'),
    title: text('title'),
    content: text('content'),
    summary: text('summary'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => ({ bySiteRun: index('idx_crawl_pages_site_run').on(t.websiteId, t.runId), bySiteUrl: index('idx_crawl_pages_site_url').on(t.websiteId, t.url) })
)
