// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, requireSession, requireWebsiteAccess } from '@app/api-utils'
import { websitesRepo } from '@entities/website/repository'
import { keywords } from '@entities/keyword/db/schema.keywords'
import { getDb, hasDatabase } from '@common/infra/db'
import { eq } from 'drizzle-orm'
import { integrations } from '@entities/integration/db/schema.integrations'
import { articles } from '@entities/article/db/schema'
import { buildIntegrationViews } from '@integrations/shared/catalog'

export const Route = createFileRoute('/api/websites/$websiteId/snapshot')({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        await requireSession(request)
        // reuse project access guard semantics if needed
        await requireWebsiteAccess(request, params.websiteId)
        const website = await websitesRepo.get(params.websiteId)
        if (!website) return httpError(404, 'Website not found')
        let keywords = []
        let integrations = []
        let articlesList = []
        let integrationViews = []
        if (hasDatabase()) {
          const db = getDb()
          try {
            keywords = await db.select().from(keywords).where(eq(keywords.websiteId, params.websiteId)).limit(100)
            integrations = await db.select().from(integrations).where(eq(integrations.websiteId, params.websiteId)).limit(20)
            articlesList = await db.select().from(articles).where(eq((articles as any).websiteId, params.websiteId)).limit(120)
            // Build computed views for client UX using catalog manifests
            integrationViews = buildIntegrationViews(
              (integrations as any[]).map((i) => ({
                id: i.id,
                websiteId: website.id,
                type: i.type,
                status: i.status,
                configJson: i.configJson ? (typeof i.configJson === 'string' ? JSON.parse(i.configJson) : i.configJson) : null
              })) as any
            ) as any
          } catch {}
        }
        // Derive plan items and queue depth for dashboard
        const planItems = (articlesList as any[])
          .filter((a) => (a as any)?.scheduledDate)
          .map((a) => ({ id: a.id, websiteId: (a as any).websiteId, keywordId: a.keywordId ?? null, title: a.title ?? '', scheduledDate: (a as any).scheduledDate ?? '', status: a.status ?? 'queued', outlineJson: a.outlineJson ?? null }))
        const queueDepth = (articlesList as any[]).filter((a) => (a?.status || '') === 'queued').length
        return json({ website, keywords, integrations, integrationViews, articles: articlesList, planItems, queueDepth })
      }
    }
  }
})
