// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, safeHandler, requireSession } from '@app/api-utils'
import { hasDatabase, getDb } from '@common/infra/db'
import { integrations } from '@entities/integration/db/schema.integrations'
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
          .update(integrations)
          .set({
            status: body?.status,
            configJson: body?.config ? JSON.stringify(body.config) : null,
            updatedAt: new Date() as any
          })
          .where(eq(integrations.id, params.integrationId))
        const [row] = await db
          .select()
          .from(integrations)
          .where(eq(integrations.id, params.integrationId))
          .limit(1)
        if (!row) return httpError(404, 'Integration not found')
        return json(row)
      }),
      DELETE: safeHandler(async ({ params, request }) => {
        await requireSession(request)
        if (!hasDatabase()) return httpError(404, 'Integration not found')
        const db = getDb()
        await db.delete(integrations).where(eq(integrations.id, params.integrationId))
        return new Response(null, { status: 204 })
      })
    }
  }
})

