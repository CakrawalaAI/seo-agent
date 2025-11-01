import { createFileRoute } from '@tanstack/react-router'
import { json, requireSession, requireProjectAccess } from '@app/api-utils'
import { integrationsRepo } from '@entities/integration/repository'
import { connectorRegistry } from '@common/connectors/registry'

export const Route = createFileRoute('/api/integrations/$integrationId/test')({
  server: {
    handlers: {
      POST: async ({ params, request }) => {
        await requireSession(request)
        const integration = await integrationsRepo.get(params.integrationId)
        if (!integration) return new Response('Not found', { status: 404 })
        await requireProjectAccess(request, String(integration.projectId))

        try {
          // Use connector registry test method
        const ok = await connectorRegistry.test(integration.type, integration.configJson ?? {})
          return ok ? json({ ok: true }) : new Response('Failed', { status: 400 })
        } catch (error) {
          console.error('[Integration Test] Error:', error)
          return new Response('Failed', { status: 400 })
        }
      }
    }
  }
})
