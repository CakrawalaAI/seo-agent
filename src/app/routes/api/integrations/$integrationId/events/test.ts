// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, safeHandler, requireSession, requireWebsiteAccess } from '@app/api-utils'
import { hasDatabase, getDb } from '@common/infra/db'
import { integrations } from '@entities/integration/db/schema.integrations'
import { eq } from 'drizzle-orm'
import { webhookService } from '@entities/webhook/service'

export const Route = createFileRoute('/api/integrations/$integrationId/events/test')({
  server: {
    handlers: {
      POST: safeHandler(async ({ params, request }) => {
        await requireSession(request)
        if (!hasDatabase()) return httpError(404, 'Integration not found')
        const db = getDb()
        const [integration] = await db.select().from(integrations).where(eq(integrations.id, params.integrationId)).limit(1)
        if (!integration) return httpError(404, 'Integration not found')
        await requireWebsiteAccess(request, String((integration as any).websiteId))

        // deliver a test.ping with a synthetic article and record logs
        let config: any = {}
        const raw = (integration as any).configJson
        if (raw && typeof raw === 'string') {
          try { config = JSON.parse(raw) } catch { config = {} }
        } else if (raw && typeof raw === 'object') {
          config = raw
        }

        // minimal stub article for envelope
        const article = { id: 'art_test', title: 'Webhook Test', bodyHtml: '<p>hello</p>', language: 'en', outlineJson: [] } as any
        const res = await webhookService.deliverArticleEvent(
          { id: (integration as any).id, websiteId: (integration as any).websiteId, type: (integration as any).type, status: (integration as any).status } as any,
          { targetUrl: String(config?.targetUrl || ''), secret: typeof config?.secret === 'string' ? config.secret : null, subscribedEvents: (config as any)?.subscribedEvents ?? null, scheduleMode: (config as any)?.scheduleMode ?? 'both' },
          article,
          'test.ping',
          'test'
        )
        return res ? json({ ok: true }) : httpError(400, 'Test failed')
      })
    }
  }
})
