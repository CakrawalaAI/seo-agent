// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, requireSession, requireWebsiteAccess } from '@app/api-utils'
import { websitesRepo } from '@entities/website/repository'
import { keywords as keywordsTable } from '@entities/keyword/db/schema.keywords'
import { getDb, hasDatabase } from '@common/infra/db'
import { eq, desc, sql } from 'drizzle-orm'
import { integrations as integrationsTable } from '@entities/integration/db/schema.integrations'
import { articles as articlesTable } from '@entities/article/db/schema'
import { crawlJobs, crawlPages } from '@entities/crawl/db/schema.website'
import { env } from '@common/infra/env'
import { buildIntegrationViews } from '@integrations/shared/catalog'
import { ensureRealtimeHub, publishDashboardProgress } from '@common/realtime/hub'
import { getSubscriptionEntitlementByOrg } from '@entities/subscription/service'
import { getEntitlements } from '@common/infra/entitlements'
import { planRepo } from '@entities/article/planner'

const DEFAULT_PLAN_DAYS = 30

ensureRealtimeHub()

function safeParse(value: string) {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function nextEligibleIso(reference: string | null, cooldownHours: number): string | null {
  if (!reference) return null
  if (!Number.isFinite(cooldownHours) || cooldownHours <= 0) return null
  const base = new Date(reference)
  if (Number.isNaN(base.getTime())) return null
  const target = base.getTime() + cooldownHours * 60 * 60 * 1000
  return new Date(target).toISOString()
}

export const Route = createFileRoute('/api/websites/$websiteId/snapshot')({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        await requireSession(request)
        // reuse project access guard semantics if needed
        await requireWebsiteAccess(request, params.websiteId)
        const website = await websitesRepo.get(params.websiteId)
        if (!website) return httpError(404, 'Website not found')
        let keywordRows = []
        let integrationRows = []
        let articlesList = []
        let integrationViews = []
        const crawlTarget = Math.max(1, Number(env.crawlBudgetPages || 50))
        let crawlProgress = { jobId: null as string | null, startedAt: null as string | null, completedAt: null as string | null, crawledCount: 0, targetCount: crawlTarget }
        let keywordProgress = { total: 0, latestCreatedAt: null as string | null }
        let crawlStatus: 'idle' | 'running' | 'cooldown' = 'idle'
        let crawlCooldownExpiresAt: string | null = null
        let lastCrawlAt: string | null = null
        let playwrightWorkers: { active: number; max: number } | null = null
        if (hasDatabase()) {
          const db = getDb()
          try {
            keywordRows = await db.select().from(keywordsTable).where(eq(keywordsTable.websiteId, params.websiteId)).limit(100)
            integrationRows = await db.select().from(integrationsTable).where(eq(integrationsTable.websiteId, params.websiteId)).limit(20)
            articlesList = await db.select().from(articlesTable).where(eq((articlesTable as any).websiteId, params.websiteId)).limit(120)
            // Build computed views for client UX using catalog manifests
            integrationViews = buildIntegrationViews(
              (integrationRows as any[]).map((i) => ({
                id: i.id,
                websiteId: website.id,
                type: i.type,
                status: i.status,
                configJson: i.configJson ? (typeof i.configJson === 'string' ? safeParse(i.configJson) : i.configJson) : null,
                secretsId: i.secretsId ?? null,
                metadataJson: i.metadataJson ? (typeof i.metadataJson === 'string' ? safeParse(i.metadataJson) : i.metadataJson) : null,
                lastTestedAt: i.lastTestedAt ? new Date(i.lastTestedAt as any).toISOString() : null,
                lastError: i.lastError ?? null
              })) as any
            ) as any
            keywordProgress = {
              total: keywordRows.length,
              latestCreatedAt: keywordRows.reduce<string | null>((latest, current) => {
                const created = (current as any)?.createdAt ? new Date((current as any).createdAt) : null
                if (!created || Number.isNaN(created.getTime())) return latest
                const iso = created.toISOString()
                return !latest || iso > latest ? iso : latest
              }, null)
            }

            const crawlJobsRows = await db
              .select()
              .from(crawlJobs)
              .where(eq(crawlJobs.websiteId, params.websiteId))
              .orderBy(desc(crawlJobs.createdAt as any))
              .limit(1)

            const latestJob = crawlJobsRows[0]
            if (latestJob) {
              const startedIso = latestJob.startedAt ? new Date(latestJob.startedAt as any).toISOString() : null
              const completedIso = latestJob.completedAt ? new Date(latestJob.completedAt as any).toISOString() : null
              const createdIso = latestJob.createdAt ? new Date(latestJob.createdAt as any).toISOString() : null
              lastCrawlAt = startedIso ?? createdIso
              const [{ value: crawledCountValue } = { value: 0 }] = await db
                .select({ value: sql<number>`count(*)` })
                .from(crawlPages)
                .where(eq(crawlPages.jobId, latestJob.id))

              const crawledCount = Number(crawledCountValue ?? 0)
              crawlProgress = {
                jobId: latestJob.id,
                startedAt: startedIso,
                completedAt: completedIso,
                crawledCount,
                targetCount: crawlTarget
              }
              if (!latestJob.completedAt) {
                crawlStatus = 'running'
              } else {
                const eligibleIso = nextEligibleIso(completedIso ?? startedIso ?? createdIso, env.crawlCooldownHours)
                if (eligibleIso) {
                  const eligibleAtMs = new Date(eligibleIso).getTime()
                  if (eligibleAtMs > Date.now()) {
                    crawlStatus = 'cooldown'
                    crawlCooldownExpiresAt = eligibleIso
                  }
                }
              }
            }
          } catch {}
        }
        // Derive plan items and queue depth for dashboard
        const planItems = (articlesList as any[])
          .filter((a) => (a as any)?.scheduledDate)
          .map((a) => ({ id: a.id, websiteId: (a as any).websiteId, keywordId: a.keywordId ?? null, title: a.title ?? '', scheduledDate: (a as any).scheduledDate ?? '', status: a.status ?? 'queued', outlineJson: a.outlineJson ?? null }))
        const queueDepth = (articlesList as any[]).filter((a) => (a?.status || '') === 'queued').length
        const scheduledCount = planItems.filter((item) => (item.status || '').toLowerCase() === 'scheduled').length
        const generatedCount = planItems.length
        const fullyGeneratedCount = (articlesList as any[]).filter((row) => {
          const status = String(row?.status || '').toLowerCase()
          const hasBody = typeof (row as any)?.bodyHtml === 'string' && (row as any)?.bodyHtml.trim().length > 0
          return hasBody && (status === 'scheduled' || status === 'published')
        }).length
        const plannerCounts = snapshotPlanCounts(planItems)
        const articleProgress = {
          scheduledCount,
          generatedCount,
          fullyGeneratedCount,
          targetCount: Math.max(generatedCount, DEFAULT_PLAN_DAYS)
        }
        const billingState = await buildBillingState(website.orgId)
        publishDashboardProgress(params.websiteId, {
          crawlProgress,
          keywordProgress,
          articleProgress,
          queueDepth,
          crawlStatus,
          crawlCooldownExpiresAt,
          lastCrawlAt,
          playwrightWorkers: playwrightWorkers || undefined
        })
        return json({
          website,
          keywords: keywordRows,
          integrations: integrationRows,
          integrationViews,
          articles: articlesList,
          planItems,
          queueDepth,
          keywordProgress,
          crawlProgress,
          articleProgress,
          plannerCounts,
          billingState,
          crawlStatus,
          crawlCooldownExpiresAt,
          lastCrawlAt,
          playwrightWorkers
        })
      }
    }
  }
})

async function buildBillingState(orgId: string | null | undefined): Promise<Record<string, unknown> | null> {
  if (!orgId) return null
  try {
    const [subscription, entitlements] = await Promise.all([
      getSubscriptionEntitlementByOrg(orgId).catch(() => null),
      getEntitlements(orgId).catch(() => null)
    ])
    const status = subscription?.status ?? (entitlements as any)?.status ?? null
    const activeUntil = subscription?.currentPeriodEnd ?? (entitlements as any)?.activeUntil ?? null
    const trialEndsAt = subscription?.trialEndsAt ?? (entitlements as any)?.trialEndsAt ?? null
    const trial = (entitlements as any)?.trial ?? null
    return {
      status,
      activeUntil,
      trialEndsAt,
      trial
    }
  } catch {
    return null
  }
}

function snapshotPlanCounts(planItems: Array<{ status?: string | null; outlineJson?: unknown }>): {
  complimentaryRemaining?: number | null
  complimentaryLimit?: number | null
  complimentaryUsed?: number | null
} {
  // Placeholder for future detailed counts; currently return empty structure
  return {}
}
