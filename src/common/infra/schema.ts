// Aggregate Drizzle schema tables so we can pass to drizzle() and Better Auth adapter
import * as article from '@entities/article/db/schema'
import * as articleAttachments from '@entities/article/db/schema.attachments'
import * as integration from '@entities/integration/db/schema'
import * as keyword from '@entities/keyword/db/schema'
import * as metrics from '@entities/metrics/db/schema'
import * as org from '@entities/org/db/schema'
import * as project from '@entities/project/db/schema'
import * as subscription from '@entities/subscription/db/schema'
import * as auth from '@entities/auth/db/schema'

export const schema = {
  // app tables
  ...article,
  ...articleAttachments,
  ...integration,
  ...keyword,
  ...metrics,
  ...org,
  ...project,
  ...subscription,
  // better-auth tables (minimal)
  ...auth
}

export type AppSchema = typeof schema
