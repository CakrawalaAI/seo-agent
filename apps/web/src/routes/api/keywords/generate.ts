// @ts-nocheck
import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { startDiscovery } from '~/server/services/discovery'
import { httpError, json, safeHandler } from '../utils'

const KeywordGenerationSchema = z.object({
  projectId: z.string().min(1),
  locale: z.string().min(2).optional(),
  location: z.string().min(2).optional(),
  max: z.number().int().positive().max(2000).optional(),
  includeGAds: z.boolean().optional()
})

export const Route = createFileRoute('/api/keywords/generate')({
  server: {
    handlers: {
      POST: safeHandler(async ({ request }) => {
        const body = await request.json().catch(() => ({}))
        const parsed = KeywordGenerationSchema.safeParse(body)
        if (!parsed.success) {
          return httpError(400, 'Invalid keyword generation payload', parsed.error.flatten())
        }

        const { projectId, locale, location, max, includeGAds } = parsed.data
        const response = await startDiscovery({
          projectId,
          locale,
          location,
          maxKeywords: max,
          includeGAds
        })

        const status = response.reused ? 200 : 202
        return json(response, { status })
      })
    }
  }
})
