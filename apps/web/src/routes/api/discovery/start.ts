// @ts-nocheck
import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { startDiscovery } from '~/server/services/discovery'
import { json, parseJson, safeHandler } from '../utils'

const StartDiscoverySchema = z.object({
  projectId: z.string().min(1),
  locale: z.string().min(2).optional(),
  location: z.string().min(2).optional(),
  max: z.number().int().positive().max(2000).optional(),
  includeGAds: z.boolean().optional()
})

export const Route = createFileRoute('/api/discovery/start')({
  server: {
    handlers: {
      POST: safeHandler(async ({ request }) => {
        const input = await parseJson(request, StartDiscoverySchema)
        const result = await startDiscovery({
          projectId: input.projectId,
          locale: input.locale,
          location: input.location,
          maxKeywords: input.max,
          includeGAds: input.includeGAds
        })
        return json(result, { status: 202 })
      })
    }
  }
})
