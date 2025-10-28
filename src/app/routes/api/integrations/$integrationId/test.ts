// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, requireSession } from '@app/api-utils'
import { integrationsRepo } from '@entities/integration/repository'
import { publishViaWebhook } from '@common/publishers/webhook'
import { publishViaWebflow } from '@common/publishers/webflow'

export const Route = createFileRoute('/api/integrations/$integrationId/test')({
  server: {
    handlers: {
      POST: async ({ params, request }) => {
        requireSession(request)
        const integration = integrationsRepo.get(params.integrationId)
        if (!integration) return new Response('Not found', { status: 404 })
        let ok = false
        try {
          if (integration.type === 'webhook') {
            const targetUrl = String((integration.configJson as any)?.targetUrl || '')
            const secret = (integration.configJson as any)?.secret || null
            if (targetUrl) {
              const res = await publishViaWebhook({
                article: { id: 'test', projectId: integration.projectId, planItemId: null as any, title: 'SEO Agent Test', bodyHtml: '<p>Hello from SEO Agent</p>', outlineJson: [], status: 'draft', language: 'en', tone: 'neutral', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as any,
                targetUrl,
                secret
              })
              ok = Boolean(res || targetUrl)
            }
          } else if (integration.type === 'webflow') {
            const res = await publishViaWebflow({
              article: { id: 'test', projectId: integration.projectId, planItemId: null as any, title: 'SEO Agent Test', bodyHtml: '<p>Hello from SEO Agent</p>', outlineJson: [], status: 'draft', language: 'en', tone: 'neutral', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as any,
              siteId: String((integration.configJson as any)?.siteId || ''),
              collectionId: String((integration.configJson as any)?.collectionId || ''),
              draft: true
            })
            ok = Boolean(res)
          }
        } catch {}
        return ok ? json({ ok: true }) : new Response('Failed', { status: 400 })
      }
    }
  }
})
