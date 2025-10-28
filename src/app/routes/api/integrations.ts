// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, safeHandler, requireSession, requireProjectAccess } from '@app/api-utils'
import { integrationsRepo } from '@entities/integration/repository'
import { hasDatabase, getDb } from '@common/infra/db'
import { projectIntegrations } from '@entities/integration/db/schema'

export const Route = createFileRoute('/api/integrations')({
  server: {
    handlers: {
      POST: safeHandler(async ({ request }) => {
        requireSession(request)
        const body = await request.json().catch(() => ({}))
        const { projectId, type, status, config } = body ?? {}
        if (!projectId || !type) return httpError(400, 'Missing fields')
        await requireProjectAccess(request, String(projectId))
        const integration = integrationsRepo.create({
          projectId: String(projectId),
          type: String(type),
          status: status ? String(status) : undefined,
          configJson: config ?? null
        })
        if (hasDatabase()) {
          try {
            const db = getDb()
            await db
              .insert(projectIntegrations)
              .values({ id: integration.id, projectId: integration.projectId, type: integration.type, status: integration.status, configJson: integration.configJson, updatedAt: new Date() as any })
              .onConflictDoNothing()
          } catch {}
        }
        return json(integration, { status: 201 })
      })
    }
  }
})
