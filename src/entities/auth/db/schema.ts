import { pgTable, text, timestamp, jsonb, boolean, uniqueIndex } from 'drizzle-orm/pg-core'

export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull(),
    name: text('name'),
    image: text('image'),
    emailVerified: boolean('email_verified').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => ({
    emailUnique: uniqueIndex('users_email_unique').on(t.email)
  })
)

export const userAuthProviders = pgTable(
  'user_auth_providers',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    providerId: text('provider_id').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    idToken: text('id_token'),
    scope: text('scope'),
    rawJson: jsonb('raw_json').$type<Record<string, unknown> | null>().default(null),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => ({
    uniqProviderAccount: uniqueIndex('user_auth_providers_unique').on(t.providerId, t.providerAccountId)
  })
)
