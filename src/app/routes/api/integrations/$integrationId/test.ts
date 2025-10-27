// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { integrationsRepo } from '@entities/integration/repository'

export const Route = createFileRoute('/api/integrations/$integrationId/test')({
  server: {
    handlers: {
      POST: ({ params }) => {
        const integration = integrationsRepo.get(params.integrationId)
        if (!integration) return new Response('Not found', { status: 404 })
        return new Response(null, { status: 204 })
      }
    }
  }
})

