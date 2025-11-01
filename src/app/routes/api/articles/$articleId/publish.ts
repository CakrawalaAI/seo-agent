import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, safeHandler, requireSession, requireProjectAccess } from '@app/api-utils'
import { articlesRepo } from '@entities/article/repository'
import { integrationsRepo } from '@entities/integration/repository'
import { connectorRegistry } from '@common/connectors/registry'
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

        await requireProjectAccess(request, String(article.projectId))

        const integration = await integrationsRepo.get(String(integrationId))
        if (!integration) return httpError(404, 'Integration not found')

        console.info('[API /articles/:id/publish] Request:', {
          articleId: article.id,
          projectId: article.projectId,
          integrationId,
          queueEnabled: queueEnabled()
        })

        // Queue publish job if queue enabled
        if (queueEnabled()) {
          const jobId = await publishJob({
            type: 'publish',
            payload: { articleId: article.id, integrationId }
          })
          recordJobQueued(article.projectId, 'publish', jobId)
          console.info('[API /articles/:id/publish] Queued:', { jobId })
          return json({ jobId })
        }

        // Synchronous publish (fallback if no queue)
        const result = await connectorRegistry.publish(integration.type, article, integration.configJson ?? {})

        if (!result) {
          return httpError(500, 'Publishing failed')
        }

        await articlesRepo.update(article.id, {
          status: 'published',
          bodyHtml: article.bodyHtml ?? '',
          cmsExternalId: result.externalId ?? null,
          url: result.url ?? null,
          publicationDate: new Date().toISOString()
        })

        console.warn('[API /articles/:id/publish] Published synchronously (queue disabled)', {
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
