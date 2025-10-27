// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, safeHandler } from './utils'
import { integrationsRepo } from '@entities/integration/repository'

export const Route = createFileRoute('/api/integrations')({
  server: {
    handlers: {
      POST: safeHandler(async ({ request }) => {
        const body = await request.json().catch(() => ({}))
        const { projectId, type, status, config } = body ?? {}
        if (!projectId || !type) return httpError(400, 'Missing fields')
        const integration = integrationsRepo.create({
          projectId: String(projectId),
          type: String(type),
          status: status ? String(status) : undefined,
          configJson: config ?? null
        })
        return json(integration, { status: 201 })
      })
    }
  }
})

