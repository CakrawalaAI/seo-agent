import { integer, jsonb, pgTable, text, timestamp, index } from 'drizzle-orm/pg-core'
import { projects } from '../../project/db/schema'

export const crawlPages = pgTable(
  'crawl_pages',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    depth: integer('depth'),
    httpStatus: integer('http_status'),
    status: text('status'),
    extractedAt: timestamp('extracted_at', { withTimezone: true }),
    metaJson: jsonb('meta_json').$type<Record<string, unknown> | null>().default(null),
    headingsJson: jsonb('headings_json').$type<unknown | null>().default(null),
    linksJson: jsonb('links_json').$type<unknown | null>().default(null),
    contentBlobUrl: text('content_blob_url'),
    contentText: text('content_text'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => ({
    byProject: index('idx_crawl_pages_project').on(t.projectId),
    byProjectUrl: index('idx_crawl_pages_project_url').on(t.projectId, t.url)
  })
)

