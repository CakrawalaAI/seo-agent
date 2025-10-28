import { jsonb, pgTable, text, integer, timestamp, index } from 'drizzle-orm/pg-core'

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
    httpStatus: text('http_status'),
    status: text('status').notNull().default('queued'),
    extractedAt: timestamp('extracted_at', { withTimezone: true }),
    metaJson: jsonb('meta_json').$type<Record<string, unknown> | null>().default(null),
    headingsJson: jsonb('headings_json').$type<Array<{ level: number; text: string }> | null>().default(null),
    linksJson: jsonb('links_json').$type<Array<{ href: string; text?: string }> | null>().default(null),
    contentBlobUrl: text('content_blob_url'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => ({
    byProjectUrl: index('idx_crawl_pages_project_url').on(t.projectId, t.url)
  })
)

// Link graph (edges)
export const linkGraph = pgTable(
  'link_graph',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    fromUrl: text('from_url').notNull(),
    toUrl: text('to_url').notNull(),
    anchorText: text('anchor_text')
  },
  (t) => ({
    byProjectFrom: index('idx_link_graph_project_from').on(t.projectId, t.fromUrl),
    byProjectTo: index('idx_link_graph_project_to').on(t.projectId, t.toUrl)
  })
)
