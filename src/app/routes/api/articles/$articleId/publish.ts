// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, safeHandler, requireSession, requireProjectAccess } from '@app/api-utils'
import { articlesRepo } from '@entities/article/repository'
import { integrationsRepo } from '@entities/integration/repository'
import { publishViaWebhook } from '@common/publishers/webhook'
import { publishViaWebflow } from '@common/publishers/webflow'
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
        const article = articlesRepo.get(params.articleId)
        if (!article) return httpError(404, 'Article not found')
        await requireProjectAccess(request, String(article.projectId))
        const integration = integrationsRepo.get(String(integrationId))
        if (!integration) return httpError(404, 'Integration not found')
        console.info('[api/articles/:id/publish] request', { articleId: article.id, projectId: article.projectId, integrationId, queueEnabled: queueEnabled() })
        if (queueEnabled()) {
          const jobId = await publishJob({ type: 'publish', payload: { articleId: article.id, integrationId } })
          recordJobQueued(article.projectId, 'publish', jobId)
          console.info('[api/articles/:id/publish] queued', { jobId })
          return json({ jobId })
        } else {
          let result: { externalId?: string; url?: string } | null = null
          if (integration.type === 'webhook') {
            result = await publishViaWebhook({
              article,
              targetUrl: String(integration.configJson?.targetUrl ?? ''),
              secret: (integration.configJson as any)?.secret ?? null
            })
          } else if (integration.type === 'webflow') {
            result = await publishViaWebflow({
              article,
              siteId: String((integration.configJson as any)?.siteId ?? ''),
              collectionId: String((integration.configJson as any)?.collectionId ?? ''),
              draft: Boolean((integration.configJson as any)?.draft)
            })
          } else {
            // fallback mock
            result = { externalId: `ext_${article.id}`, url: `https://example.com/published/${article.id}` }
          }
          articlesRepo.update(article.id, {
            status: 'published',
            bodyHtml: article.bodyHtml ?? '',
            cmsExternalId: result?.externalId ?? null,
            url: result?.url ?? null,
            publicationDate: new Date().toISOString()
          })
          console.warn('[api/articles/:id/publish] queue disabled; published synchronously', { articleId: article.id })
          return json({ jobId: genId('job'), externalId: result?.externalId, url: result?.url })
        }
      })
    }
  }
})

function genId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}
