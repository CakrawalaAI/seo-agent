// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, safeHandler, requireSession, requireWebsiteAccess } from '@app/api-utils'
import { hasDatabase, getDb } from '@common/infra/db'
import { integrations } from '@entities/integration/db/schema.integrations'
import { webhookDeliveries, webhookEvents } from '@entities/webhook/db/schema'
import { eq } from 'drizzle-orm'
import { webhookService } from '@entities/webhook/service'
import { articles } from '@entities/article/db/schema'

export const Route = createFileRoute('/api/integrations/$integrationId/deliveries/$deliveryId/retry')({
  server: {
    handlers: {
      POST: safeHandler(async ({ params, request }) => {
        await requireSession(request)
        if (!hasDatabase()) return httpError(404, 'Not found')
        const db = getDb()
        const [integration] = await db.select().from(integrations).where(eq(integrations.id, params.integrationId)).limit(1)
        if (!integration) return httpError(404, 'Integration not found')
        await requireWebsiteAccess(request, String((integration as any).websiteId))

        const [delivery] = await db.select().from(webhookDeliveries).where(eq(webhookDeliveries.id, params.deliveryId)).limit(1)
        if (!delivery) return httpError(404, 'Delivery not found')
        const [event] = await db.select().from(webhookEvents).where(eq(webhookEvents.id, delivery.eventId)).limit(1)
        if (!event) return httpError(404, 'Event not found')

        // Load article for context if available
        let article: any = null
        if (event.articleId) {
          const rows = await db.select().from(articles).where(eq(articles.id, event.articleId)).limit(1)
          article = rows?.[0] ?? null
        }

        // Prepare config
        let config: any = {}
        const raw = (integration as any).configJson
        if (raw && typeof raw === 'string') {
          try { config = JSON.parse(raw) } catch { config = {} }
        } else if (raw && typeof raw === 'object') {
          config = raw
        }

        // Re-deliver based on original event type; if no article (e.g., test.ping), use a stub
        const evtType = String((event as any).eventType || 'article.published') as any
        if (!article) {
          article = { id: 'art_test', title: 'Webhook Test', bodyHtml: '<p>hello</p>', language: 'en', outlineJson: [] } as any
        }
        const result = await webhookService.deliverArticleEvent(
          { id: (integration as any).id, websiteId: (integration as any).websiteId, type: (integration as any).type, status: (integration as any).status } as any,
          { targetUrl: String(config?.targetUrl || ''), secret: typeof config?.secret === 'string' ? config.secret : null, subscribedEvents: (config as any)?.subscribedEvents ?? null, scheduleMode: (config as any)?.scheduleMode ?? 'both' },
          article,
          evtType,
          evtType === 'test.ping' ? 'test' : 'manual'
        )

        return json({ ok: Boolean(result) })
      })
    }
  }
})
