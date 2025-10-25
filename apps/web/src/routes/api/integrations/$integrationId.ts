// @ts-nocheck
import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { UpdateIntegrationInputSchema } from '@seo-agent/domain'
import { deleteIntegration, updateIntegration } from '~/server/services/orgs'
import { httpError, json, parseJson, safeHandler } from '../utils'

const ParamsSchema = z.object({ integrationId: z.string().min(1) })

export const Route = createFileRoute('/api/integrations/$integrationId')({
  server: {
    handlers: {
      PATCH: safeHandler(async ({ params, request }) => {
        const { integrationId } = ParamsSchema.parse(params)
        const input = await parseJson(request, UpdateIntegrationInputSchema)
        const integration = await updateIntegration(integrationId, input)
        if (!integration) {
          return httpError(404, 'Integration not found')
        }
        return json(integration)
      }),
      DELETE: safeHandler(async ({ params }) => {
        const { integrationId } = ParamsSchema.parse(params)
        const removed = await deleteIntegration(integrationId)
        if (!removed) {
          return httpError(404, 'Integration not found')
        }
        return json({ status: 'ok', integrationId })
      })
    }
  }
})
