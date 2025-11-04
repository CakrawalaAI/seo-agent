import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, safeHandler, requireSession, requireWebsiteAccess } from '@app/api-utils'
import { log } from '@src/common/logger'
import { articlesRepo } from '@entities/article/repository'
import { connectorRegistry } from '@features/integrations/server/registry'
import { queueEnabled, publishJob } from '@common/infra/queue'
import { recordJobQueued } from '@common/infra/jobs'

export const Route = createFileRoute('/api/articles/$articleId/publish')({
  server: {
    handlers: {
      POST: safeHandler(async ({ params, request }) => {
        await requireSession(request)
        const body = await request.json().catch(() => ({}))
        const integrationId = body?.integrationId

        if (!integrationId) return httpError(400, 'Missing integrationId')

        const article = await articlesRepo.get(params.articleId)
        if (!article) return httpError(404, 'Article not found')

        await requireWebsiteAccess(request, String((article as any).websiteId))

        const integration = await (async () => {
          try {
            const { getDb, hasDatabase } = await import('@common/infra/db')
            const { integrations } = await import('@entities/integration/db/schema.integrations')
            const { eq } = await import('drizzle-orm')
            if (!hasDatabase()) return null
            const db = getDb()
            const rows = await db.select().from(integrations).where(eq(integrations.id, String(integrationId))).limit(1)
            return rows?.[0] ?? null
          } catch { return null }
        })()
        if (!integration) return httpError(404, 'Integration not found')

        log.info('[API /articles/:id/publish] Request:', {
          articleId: article.id,
          websiteId: (article as any).websiteId,
          integrationId,
          queueEnabled: queueEnabled()
        })

        // Queue publish job if queue enabled
        if (queueEnabled()) {
          const jobId = await publishJob({
            type: 'publish',
            payload: { articleId: article.id, integrationId }
          })
          recordJobQueued(String((article as any).websiteId), 'publish', jobId)
          log.info('[API /articles/:id/publish] Queued:', { jobId })
          return json({ jobId })
        }

        // Synchronous publish (fallback if no queue)
        const result = await connectorRegistry.publish((integration as any).type, article, (integration as any).configJson ?? {})

        if (!result) {
          return httpError(500, 'Publishing failed')
        }

        await articlesRepo.update(article.id, {
          status: 'published',
          bodyHtml: article.bodyHtml ?? '',
          cmsExternalId: result.externalId ?? null,
          url: result.url ?? null,
          publishDate: new Date().toISOString()
        })

        log.warn('[API /articles/:id/publish] Published synchronously (queue disabled)', {
          articleId: article.id
        })

        return json({
          jobId: genId('job'),
          externalId: result.externalId,
          url: result.url
        })
      })
    }
  }
})

function genId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}
