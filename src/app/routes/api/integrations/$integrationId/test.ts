import { createFileRoute } from '@tanstack/react-router'
import { json, requireSession, requireWebsiteAccess } from '@app/api-utils'
import { getDb, hasDatabase } from '@common/infra/db'
import { integrations } from '@entities/integration/db/schema.integrations'
import { eq } from 'drizzle-orm'
import { connectorRegistry } from '@features/integrations/server/registry'
import { log } from '@src/common/logger'

export const Route = createFileRoute('/api/integrations/$integrationId/test')({
  server: {
    handlers: {
      POST: async ({ params, request }) => {
        await requireSession(request)
        if (!hasDatabase()) return new Response('Not found', { status: 404 })
        const db = getDb()
        const [integration] = await db.select().from(integrations).where(eq(integrations.id, params.integrationId)).limit(1)
        if (!integration) return new Response('Not found', { status: 404 })
        await requireWebsiteAccess(request, String((integration as any).websiteId))

        try {
          // Use connector registry test method
        const ok = await connectorRegistry.test((integration as any).type, (integration as any).configJson ?? {})
          return ok ? json({ ok: true }) : new Response('Failed', { status: 400 })
        } catch (error) {
          log.error('[Integration Test] Error:', error)
          return new Response('Failed', { status: 400 })
        }
      }
    }
  }
})
