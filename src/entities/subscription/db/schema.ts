import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'

import { users } from '@entities/auth/db/schema'
import { orgs } from '@entities/org/db/schema'

export const subscriptionEntitlements = pgTable(
  'subscription_entitlements',
  {
    polarSubscriptionId: text('polar_subscription_id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    orgId: text('org_id').references(() => orgs.id, { onDelete: 'set null' }),
    status: text('status').notNull(),
    tier: text('tier'),
    productId: text('product_id'),
    priceId: text('price_id'),
    customerId: text('customer_id'),
    seatQuantity: integer('seat_quantity'),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
    trialEndsAt: timestamp('trial_ends_at', { withTimezone: true }),
    cancelAt: timestamp('cancel_at', { withTimezone: true }),
    cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
    entitlementsJson: jsonb('entitlements').$type<Record<string, unknown> | null>().default(null),
    metadata: jsonb('metadata').$type<Record<string, unknown> | null>().default(null),
    rawPayload: jsonb('raw_payload').$type<Record<string, unknown> | null>().default(null),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => ({
    userUnique: uniqueIndex('subscription_entitlements_user_unique').on(t.userId),
    orgIdx: index('subscription_entitlements_org_idx').on(t.orgId),
    userIdx: index('subscription_entitlements_user_idx').on(t.userId)
  })
)
