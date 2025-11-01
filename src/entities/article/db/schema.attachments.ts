import { integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

import { articles } from './schema'

export const articleAttachments = pgTable('article_attachments', {
  id: text('id').primaryKey(),
  articleId: text('article_id')
    .notNull()
    .references(() => articles.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  url: text('url').notNull(),
  caption: text('caption'),
  order: integer('order'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
})
