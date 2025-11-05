import { pgTable, text, timestamp, index } from 'drizzle-orm/pg-core'
import { websites } from '@entities/website/db/schema'

export const integrations = pgTable(
  'integrations',
  {
    id: text('id').primaryKey(),
    websiteId: text('website_id')
      .notNull()
      .references(() => websites.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    status: text('status').notNull().default('draft'),
    configJson: text('config_json'),
    secretsId: text('secrets_id'),
    metadataJson: text('metadata_json'),
    lastTestedAt: timestamp('last_tested_at', { withTimezone: true }),
    lastError: text('last_error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => ({ byWebsite: index('idx_integrations_site').on(t.websiteId) })
)

export const integrationSecrets = pgTable('integration_secrets', {
  id: text('id').primaryKey(),
  integrationId: text('integration_id')
    .notNull()
    .references(() => integrations.id, { onDelete: 'cascade' }),
  ciphertext: text('ciphertext').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  rotatedAt: timestamp('rotated_at', { withTimezone: true })
})
