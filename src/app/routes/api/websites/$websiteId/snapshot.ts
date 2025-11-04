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

const DEFAULT_PLAN_DAYS = 30

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
                configJson: i.configJson ? (typeof i.configJson === 'string' ? JSON.parse(i.configJson) : i.configJson) : null
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
              const [{ value: crawledCountValue } = { value: 0 }] = await db
                .select({ value: sql<number>`count(*)` })
                .from(crawlPages)
                .where(eq(crawlPages.jobId, latestJob.id))

              const crawledCount = Number(crawledCountValue ?? 0)
              crawlProgress = {
                jobId: latestJob.id,
                startedAt: latestJob.startedAt ? new Date(latestJob.startedAt as any).toISOString() : null,
                completedAt: latestJob.completedAt ? new Date(latestJob.completedAt as any).toISOString() : null,
                crawledCount,
                targetCount: crawlTarget
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
        const articleProgress = {
          scheduledCount,
          generatedCount,
          targetCount: Math.max(generatedCount, DEFAULT_PLAN_DAYS)
        }
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
          articleProgress
        })
      }
    }
  }
})
