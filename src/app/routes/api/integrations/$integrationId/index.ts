// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, safeHandler, requireSession, requireProjectAccess } from '@app/api-utils'
import { integrationsRepo } from '@entities/integration/repository'
import { hasDatabase, getDb } from '@common/infra/db'
import { projectIntegrations } from '@entities/integration/db/schema'

export const Route = createFileRoute('/api/integrations/$integrationId/')({
  server: {
    handlers: {
      PATCH: safeHandler(async ({ params, request }) => {
        await requireSession(request)
        const body = await request.json().catch(() => ({}))
        const current = await integrationsRepo.get(params.integrationId)
        if (current) await requireProjectAccess(request, String(current.projectId))
        if (hasDatabase()) {
          try {
            const db = getDb()
            await db
              .update(projectIntegrations)
              .set({ status: body?.status, configJson: body?.config ?? null, updatedAt: new Date() as any })
              // @ts-ignore
              .where((projectIntegrations as any).id.eq(params.integrationId))
          } catch {}
        }
        const updated = await integrationsRepo.update(params.integrationId, { status: body?.status, configJson: body?.config ?? null })
        if (!updated && !current) return httpError(404, 'Integration not found')
        return json(updated ?? { id: params.integrationId })
      }),
      DELETE: safeHandler(async ({ params, request }) => {
        await requireSession(request)
        const current = await integrationsRepo.get(params.integrationId)
        if (current) await requireProjectAccess(request, String(current.projectId))
        if (hasDatabase()) {
          try {
            const db = getDb()
            // @ts-ignore
            await db.delete(projectIntegrations).where((projectIntegrations as any).id.eq(params.integrationId))
          } catch {}
        }
        const ok = await integrationsRepo.remove(params.integrationId)
        if (!ok && !current) return httpError(404, 'Integration not found')
        return new Response(null, { status: 204 })
      })
    }
  }
})
