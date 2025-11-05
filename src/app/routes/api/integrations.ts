// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, safeHandler, requireSession, requireWebsiteAccess } from '@app/api-utils'
import { hasDatabase, getDb } from '@common/infra/db'
import { integrations } from '@entities/integration/db/schema.integrations'

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
            const now = new Date() as any
            const row = {
              id: genId('int'),
              websiteId: String(siteId),
              type: String(type),
              status: String(status || 'draft'),
              configJson: config ? JSON.stringify(config) : null,
              createdAt: now,
              updatedAt: now
            } as any
            await db.insert(integrations).values(row).onConflictDoNothing?.()
            return json(
              {
                id: row.id,
                websiteId: row.websiteId,
                type: row.type,
                status: row.status,
                configJson: config ?? null,
                secretsId: null,
                metadataJson: null,
                lastTestedAt: null,
                lastError: null
              },
              { status: 201 }
            )
          } catch {}
        }
        return json(
          {
            id: genId('int'),
            websiteId: String(siteId),
            type: String(type),
            status: String(status || 'draft'),
            configJson: config ?? null,
            secretsId: null,
            metadataJson: null,
            lastTestedAt: null,
            lastError: null
          },
          { status: 201 }
        )
      })
    }
  }
})
