// Aggregate Drizzle schema tables so we can pass to drizzle() and Better Auth adapter
import * as article from '@entities/article/db/schema'
import * as keywordSerp from '@entities/article/db/schema.serp_snapshot'
import * as articleAttachments from '@entities/article/db/schema.attachments'
// project-based integration/keyword/metrics removed
import * as organizations from '@entities/org/db/schema'
import * as website from '@entities/website/db/schema'
import * as integrations from '@entities/integration/db/schema.integrations'
import * as crawlWebsite from '@entities/crawl/db/schema.website'
import * as keywords from '@entities/keyword/db/schema.keywords'
import * as subscription from '@entities/subscription/db/schema'
import * as auth from '@entities/auth/db/schema'

export const schema = {
  // app tables
  ...article,
  ...keywordSerp,
  ...articleAttachments,
  // website-first tables only
  ...organizations,
  ...website,
  ...integrations,
  ...crawlWebsite,
  ...keywords,
  ...subscription,
  // better-auth tables (minimal)
  ...auth
}

export type AppSchema = typeof schema
