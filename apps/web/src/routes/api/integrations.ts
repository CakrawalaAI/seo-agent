// @ts-nocheck
import { CreateIntegrationInputSchema } from '@seo-agent/domain'
import { createFileRoute } from '@tanstack/react-router'
import { createIntegration } from '~/server/services/orgs'
import { json, parseJson, safeHandler } from './utils'

export const Route = createFileRoute('/api/integrations')({
  server: {
    handlers: {
      POST: safeHandler(async ({ request }) => {
        const input = await parseJson(request, CreateIntegrationInputSchema)
        const integration = await createIntegration(input)
        return json(integration, { status: 201 })
      })
    }
  }
})
