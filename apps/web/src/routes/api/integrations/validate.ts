// @ts-nocheck
import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { validateIntegrationConfig } from '~/server/services/orgs'
import { httpError, json, parseJson, safeHandler } from '../utils'

const ValidationSchema = z.object({
  type: z.string().min(1),
  config: z.record(z.string(), z.unknown())
})

export const Route = createFileRoute('/api/integrations/validate')({
  server: {
    handlers: {
      POST: safeHandler(async ({ request }) => {
        const input = await parseJson(request, ValidationSchema)
        try {
          const result = await validateIntegrationConfig({
            type: input.type as any,
            config: input.config
          })
          return json(result)
        } catch (error) {
          return httpError(400, error instanceof Error ? error.message : 'Invalid integration configuration')
        }
      })
    }
  }
})
