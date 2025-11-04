// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, safeHandler, requireSession, requireWebsiteAccess } from '@app/api-utils'
import { hasDatabase, getDb } from '@common/infra/db'
import { websiteIntegrations } from '@entities/integration/db/schema.website'

export const Route = createFileRoute('/api/integrations')({
  server: {
    handlers: {
      POST: safeHandler(async ({ request }) => {
        await requireSession(request)
        const body = await request.json().catch(() => ({}))
        const { websiteId, projectId, type, status, config } = body ?? {}
        const siteId = websiteId || projectId
        if (!siteId || !type) return httpError(400, 'Missing fields')
        await requireWebsiteAccess(request, String(siteId))
        if (hasDatabase()) {
          try {
            const db = getDb()
            const row = {
              id: genId('int'),
              websiteId: String(siteId),
              type: String(type),
              status: String(status || 'connected'),
              configJson: config ? JSON.stringify(config) : null,
              createdAt: new Date() as any,
              updatedAt: new Date() as any
            } as any
            await db.insert(websiteIntegrations).values(row).onConflictDoNothing?.()
            return json({ id: row.id, websiteId: row.websiteId, type: row.type, status: row.status, configJson: config ?? null }, { status: 201 })
          } catch {}
        }
        return json({ id: genId('int'), websiteId: String(siteId), type: String(type), status: String(status || 'connected'), configJson: config ?? null }, { status: 201 })
      })
    }
  }
})
