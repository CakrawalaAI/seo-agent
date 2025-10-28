// Aggregate Drizzle schema tables so we can pass to drizzle() and Better Auth adapter
import * as article from '@entities/article/db/schema'
import * as blob from '@entities/blob/db/schema'
import * as crawl from '@entities/crawl/db/schema'
import * as integration from '@entities/integration/db/schema'
import * as job from '@entities/job/db/schema'
import * as keyword from '@entities/keyword/db/schema'
import * as metrics from '@entities/metrics/db/schema'
import * as org from '@entities/org/db/schema'
import * as plan from '@entities/plan/db/schema'
import * as project from '@entities/project/db/schema'
import * as auth from '@entities/auth/db/schema'

export const schema = {
  // app tables
  ...article,
  ...blob,
  ...crawl,
  ...integration,
  ...job,
  ...keyword,
  ...metrics,
  ...org,
  ...plan,
  ...project,
  // better-auth tables (minimal)
  ...auth
}

export type AppSchema = typeof schema

