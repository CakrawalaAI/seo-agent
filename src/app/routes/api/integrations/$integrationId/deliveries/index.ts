// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, safeHandler, requireSession, requireWebsiteAccess } from '@app/api-utils'
import { hasDatabase, getDb } from '@common/infra/db'
import { integrations } from '@entities/integration/db/schema.integrations'
import { eq } from 'drizzle-orm'
import { webhookService } from '@entities/webhook/service'

export const Route = createFileRoute('/api/integrations/$integrationId/deliveries/')({
  server: {
    handlers: {
      GET: safeHandler(async ({ params, request }) => {
        await requireSession(request)
        if (!hasDatabase()) return json({ items: [] })
        const db = getDb()
        const [integration] = await db.select().from(integrations).where(eq(integrations.id, params.integrationId)).limit(1)
        if (!integration) return json({ items: [] })
        await requireWebsiteAccess(request, String((integration as any).websiteId))
        const limit = Math.max(1, Math.min(200, Number(new URL(request.url).searchParams.get('limit') || '50')))
        const items = await webhookService.listDeliveries(params.integrationId, limit)
        return json({ items })
      })
    }
  }
})

