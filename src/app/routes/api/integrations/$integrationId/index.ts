// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, safeHandler, requireSession } from '@app/api-utils'
import { hasDatabase, getDb } from '@common/infra/db'
import { websiteIntegrations } from '@entities/integration/db/schema.website'
import { eq } from 'drizzle-orm'

export const Route = createFileRoute('/api/integrations/$integrationId/')({
  server: {
    handlers: {
      PATCH: safeHandler(async ({ params, request }) => {
        await requireSession(request)
        const body = await request.json().catch(() => ({}))
        if (!hasDatabase()) return httpError(404, 'Integration not found')
        const db = getDb()
        await db
          .update(websiteIntegrations)
          .set({
            status: body?.status,
            configJson: body?.config ? JSON.stringify(body.config) : null,
            updatedAt: new Date() as any
          })
          .where(eq(websiteIntegrations.id, params.integrationId))
        const [row] = await db
          .select()
          .from(websiteIntegrations)
          .where(eq(websiteIntegrations.id, params.integrationId))
          .limit(1)
        if (!row) return httpError(404, 'Integration not found')
        return json(row)
      }),
      DELETE: safeHandler(async ({ params, request }) => {
        await requireSession(request)
        if (!hasDatabase()) return httpError(404, 'Integration not found')
        const db = getDb()
        await db.delete(websiteIntegrations).where(eq(websiteIntegrations.id, params.integrationId))
        return new Response(null, { status: 204 })
      })
    }
  }
})

