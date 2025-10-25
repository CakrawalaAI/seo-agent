// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { GenerateKeywordsRequestSchema } from '@seo-agent/domain'
import { startDiscovery } from '~/server/services/discovery'
import { json, parseJson, safeHandler } from '../utils'

export const Route = createFileRoute('/api/keywords/generate')({
  server: {
    handlers: {
      POST: safeHandler(async ({ request }) => {
        const input = await parseJson(request, GenerateKeywordsRequestSchema)

        const response = await startDiscovery({
          projectId: input.projectId,
          locale: input.locale,
          location: input.location,
          maxKeywords: input.maxKeywords,
          includeGAds: input.includeGAds
        })

        const status = response.reused ? 200 : 202
        return json(response, { status })
      })
    }
  }
})
