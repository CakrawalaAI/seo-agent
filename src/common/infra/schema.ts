// Aggregate Drizzle schema tables so we can pass to drizzle() and Better Auth adapter
import * as article from '@entities/article/db/schema'
import * as articleSerp from '@entities/article/db/schema.serp_snapshot'
import * as articleAttachments from '@entities/article/db/schema.attachments'
// project-based integration/keyword/metrics removed
import * as org from '@entities/org/db/schema'
import * as website from '@entities/website/db/schema'
import * as websiteIntegration from '@entities/integration/db/schema.website'
import * as crawlWebsite from '@entities/crawl/db/schema.website'
import * as websiteKeywords from '@entities/keyword/db/schema.website_keywords'
import * as subscription from '@entities/subscription/db/schema'
import * as auth from '@entities/auth/db/schema'

export const schema = {
  // app tables
  ...article,
  ...articleSerp,
  ...articleAttachments,
  // website-first tables only
  ...org,
  ...website,
  ...websiteIntegration,
  ...crawlWebsite,
  ...websiteKeywords,
  ...subscription,
  // better-auth tables (minimal)
  ...auth
}

export type AppSchema = typeof schema
