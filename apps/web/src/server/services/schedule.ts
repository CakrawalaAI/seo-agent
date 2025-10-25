// @ts-nocheck
import { and, asc, desc, eq, inArray, lte, sql } from 'drizzle-orm'
import { DEFAULT_BUFFER_DAYS, type SchedulePolicy, type ScheduleRunResult } from '@seo-agent/domain'
import { getDb, schema } from '../db'
import { getJobCoordinator } from '../jobs/coordinator'

const startOfUtcDay = (date: Date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
const isoDateString = (date: Date) => date.toISOString().slice(0, 10)
const subtractUtcDays = (date: Date, days: number) => {
  const clone = new Date(date.getTime())
  clone.setUTCDate(clone.getUTCDate() - days)
  return startOfUtcDay(clone)
}
const toDateString = (value: unknown) => {
  if (!value) return null
  if (typeof value === 'string') {
    return value.length >= 10 ? value.slice(0, 10) : value
  }
  if (value instanceof Date) {
    return isoDateString(value)
  }
  return null
}

export const runSchedule = async (options: {
  projectId?: string
  policy?: SchedulePolicy
}): Promise<ScheduleRunResult> => {
  const db = getDb()
  const coordinator = getJobCoordinator()
  const todayUtc = startOfUtcDay(new Date())
  const todayIso = isoDateString(todayUtc)

  const planItems = await db.query.planItems.findMany({
    where: (table, { and: andOp, eq: eqOp, lte: lteOp }) =>
      andOp(
        eqOp(table.status, 'planned'),
        lteOp(table.plannedDate, todayIso),
        options.projectId ? eqOp(table.projectId, options.projectId) : undefined
      ),
    orderBy: (table, { asc }) => [asc(table.plannedDate), asc(table.id)]
  })

  const planItemIds = planItems.map((item) => item.id)
  const existingArticlesMap = new Map<string, typeof schema.articles.$inferSelect>()

  if (planItemIds.length > 0) {
    const existingArticles = await db
      .select()
      .from(schema.articles)
      .where(inArray(schema.articles.planItemId, planItemIds))

    for (const article of existingArticles) {
      if (article.planItemId) {
        existingArticlesMap.set(article.planItemId, article)
      }
    }
  }

  const planItemsNeedingGeneration = planItems.filter((item) => !existingArticlesMap.has(item.id))
  const activeJobStatuses = ['queued', 'running'] as const
  let enqueuedGenerateJobs = 0

  for (const item of planItemsNeedingGeneration) {
    const existingJob = await db
      .select({ id: schema.jobs.id })
      .from(schema.jobs)
      .where(
        and(
          eq(schema.jobs.projectId, item.projectId),
          eq(schema.jobs.type, 'generate'),
          inArray(schema.jobs.status, activeJobStatuses),
          sql`${schema.jobs.payload} ->> 'planItemId' = ${item.id}`
        )
      )
      .limit(1)

    if (existingJob.length > 0) {
      continue
    }

    await coordinator.enqueue({
      projectId: item.projectId,
      type: 'generate',
      priority: 0,
      payload: {
        projectId: item.projectId,
        planItemId: item.id
      }
    })
    enqueuedGenerateJobs += 1
  }

  const policyOverride = options.policy ?? undefined
  const policyCache = new Map<string, SchedulePolicy>()
  const integrationCache = new Map<string, typeof schema.integrations.$inferSelect | null>()

  const getPolicyForProject = async (projectId: string): Promise<SchedulePolicy | null> => {
    if (policyOverride) {
      return policyOverride
    }

    if (policyCache.has(projectId)) {
      return policyCache.get(projectId) ?? null
    }

    const projectRecord = await db.query.projects.findFirst({
      where: (table, { eq: eqOp }) => eqOp(table.id, projectId)
    })

    if (!projectRecord) {
      const fallback: SchedulePolicy = { policy: 'manual', bufferDays: DEFAULT_BUFFER_DAYS }
      policyCache.set(projectId, fallback)
      return fallback
    }

    const orgRecord = await db.query.orgs.findFirst({
      where: (table, { eq: eqOp }) => eqOp(table.id, projectRecord.orgId)
    })

    const entitlements = (orgRecord?.entitlements ?? {}) as {
      autoPublishPolicy?: string
      bufferDays?: number
    }

    const entPolicy =
      entitlements.autoPublishPolicy === 'manual' ||
      entitlements.autoPublishPolicy === 'immediate' ||
      entitlements.autoPublishPolicy === 'buffered'
        ? entitlements.autoPublishPolicy
        : 'buffered'

    const projectPolicy =
      projectRecord.autoPublishPolicy === 'manual' ||
      projectRecord.autoPublishPolicy === 'immediate' ||
      projectRecord.autoPublishPolicy === 'buffered'
        ? projectRecord.autoPublishPolicy
        : undefined

    const policy: SchedulePolicy = {
      policy: projectPolicy ?? entPolicy,
      bufferDays: Number.isFinite(projectRecord.bufferDays)
        ? Math.max(Number(projectRecord.bufferDays), 0)
        : Number.isFinite(entitlements.bufferDays)
          ? Math.max(Number(entitlements.bufferDays), 0)
          : DEFAULT_BUFFER_DAYS
    }

    policyCache.set(projectId, policy)
    return policy
  }

  const getIntegrationForProject = async (projectId: string) => {
    if (integrationCache.has(projectId)) {
      return integrationCache.get(projectId)
    }

    const [integration] = await db
      .select()
      .from(schema.integrations)
      .where(
        and(
          eq(schema.integrations.projectId, projectId),
          eq(schema.integrations.status, 'connected')
        )
      )
      .orderBy(desc(schema.integrations.createdAt))
      .limit(1)

    integrationCache.set(projectId, integration ?? null)
    return integration ?? null
  }

  const draftArticles = await db
    .select({
      article: schema.articles,
      plan: schema.planItems
    })
    .from(schema.articles)
    .leftJoin(schema.planItems, eq(schema.planItems.id, schema.articles.planItemId))
    .where(
      and(
        eq(schema.articles.status, 'draft'),
        options.projectId ? eq(schema.articles.projectId, options.projectId) : undefined
      )
    )

  let publishedArticles = 0

  for (const row of draftArticles) {
    const article = row.article
    const plan = row.plan
    if (!plan) {
      continue
    }

    const projectId = article.projectId
    const policy = await getPolicyForProject(projectId)
    if (!policy || policy.policy === 'manual') {
      continue
    }

    const plannedDate = toDateString(plan.plannedDate)
    if (!plannedDate) {
      continue
    }

    const bufferDays = policy.policy === 'immediate'
      ? 0
      : Math.max(policy.bufferDays ?? DEFAULT_BUFFER_DAYS, 0)

    const cutoffDate = policy.policy === 'immediate'
      ? todayIso
      : isoDateString(subtractUtcDays(todayUtc, bufferDays))

    if (policy.policy === 'immediate' && plannedDate > todayIso) {
      continue
    }

    if (policy.policy === 'buffered' && plannedDate > cutoffDate) {
      continue
    }

    const integration = await getIntegrationForProject(projectId)
    if (!integration) {
      continue
    }

    const existingPublishJob = await db
      .select({ id: schema.jobs.id })
      .from(schema.jobs)
      .where(
        and(
          eq(schema.jobs.projectId, projectId),
          eq(schema.jobs.type, 'publish'),
          inArray(schema.jobs.status, activeJobStatuses),
          sql`${schema.jobs.payload} ->> 'articleId' = ${article.id}`
        )
      )
      .limit(1)

    if (existingPublishJob.length > 0) {
      continue
    }

    await coordinator.enqueue({
      projectId,
      type: 'publish',
      priority: 0,
      payload: {
        projectId,
        articleId: article.id,
        integrationId: integration.id
      }
    })
    publishedArticles += 1
  }

  return {
    generatedDrafts: enqueuedGenerateJobs,
    enqueuedJobs: enqueuedGenerateJobs,
    publishedArticles
  }
}
