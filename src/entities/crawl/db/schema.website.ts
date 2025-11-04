import { pgTable, text, jsonb, timestamp, integer, index } from 'drizzle-orm/pg-core'
import { websites } from '@entities/website/db/schema'

export const crawlJobs = pgTable(
  'crawl_jobs',
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
  (t) => ({ byWebsite: index('idx_crawl_jobs_site').on(t.websiteId) })
)

export const crawlPages = pgTable(
  'crawl_pages',
  {
    id: text('id').primaryKey(),
    websiteId: text('website_id')
      .notNull()
      .references(() => websites.id, { onDelete: 'cascade' }),
    jobId: text('job_id')
      .notNull()
      .references(() => crawlJobs.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    httpStatus: integer('http_status'),
    title: text('title'),
    content: text('content'),
    summary: text('summary'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => ({ bySiteJob: index('idx_crawl_pages_site_job').on(t.websiteId, t.jobId), bySiteUrl: index('idx_crawl_pages_site_url').on(t.websiteId, t.url) })
)
