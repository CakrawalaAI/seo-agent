import { integer, pgTable, text, timestamp, index } from 'drizzle-orm/pg-core'
import { websites } from '@entities/website/db/schema'
import { integrations } from '@entities/integration/db/schema.integrations'
import { articles } from '@entities/article/db/schema'

export const webhookEvents = pgTable(
  'webhook_events',
  {
    id: text('id').primaryKey(),
    websiteId: text('website_id')
      .notNull()
      .references(() => websites.id, { onDelete: 'cascade' }),
    integrationId: text('integration_id')
      .notNull()
      .references(() => integrations.id, { onDelete: 'cascade' }),
    eventType: text('event_type').notNull(),
    articleId: text('article_id').references(() => articles.id, { onDelete: 'set null' }),
    payloadJson: text('payload_json').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => ({
    byIntegrationTime: index('idx_webhook_events_integration_time').on(t.integrationId, t.createdAt),
    byWebsiteTime: index('idx_webhook_events_website_time').on(t.websiteId, t.createdAt)
  })
)

export const webhookDeliveries = pgTable(
  'webhook_deliveries',
  {
    id: text('id').primaryKey(),
    eventId: text('event_id')
      .notNull()
      .references(() => webhookEvents.id, { onDelete: 'cascade' }),
    integrationId: text('integration_id')
      .notNull()
      .references(() => integrations.id, { onDelete: 'cascade' }),
    endpointUrl: text('endpoint_url').notNull(),
    attempt: integer('attempt').notNull().default(1),
    status: text('status').notNull(), // pending | success | failed
    httpCode: integer('http_code'),
    durationMs: integer('duration_ms'),
    requestHeadersJson: text('request_headers_json'),
    responseBody: text('response_body'),
    error: text('error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => ({
    byIntegrationTime: index('idx_webhook_deliveries_integration_time').on(t.integrationId, t.createdAt),
    byEventAttempt: index('idx_webhook_deliveries_event_attempt').on(t.eventId, t.attempt)
  })
)

