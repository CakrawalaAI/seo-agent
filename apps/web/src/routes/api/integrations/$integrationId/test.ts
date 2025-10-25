// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { testIntegration } from '~/server/services/orgs'
import { httpError, json, safeHandler } from '../../utils'

export const Route = createFileRoute('/api/integrations/$integrationId/test')({
  server: {
    handlers: {
      POST: safeHandler(async ({ params }) => {
        try {
          const result = await testIntegration(params.integrationId)
          return json(result)
        } catch (error) {
          const code = (error as any)?.code
          if (code === 'not_found') {
            return httpError(404, 'Integration not found')
          }
          if (code === 'unsupported' || code === 'invalid_config') {
            return httpError(400, error instanceof Error ? error.message : 'Integration not supported')
          }
          const message = error instanceof Error ? error.message : 'Integration test failed'
          return httpError(502, message)
        }
      })
    }
  }
})

