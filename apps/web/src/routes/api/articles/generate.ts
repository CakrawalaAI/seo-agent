// @ts-nocheck
import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { enqueueArticleGeneration } from '~/server/services/articles'
import { httpError, json, parseJson, safeHandler } from '../utils'

const GenerateRequestSchema = z.object({
  planItemId: z.string().min(1)
})

export const Route = createFileRoute('/api/articles/generate')({
  server: {
    handlers: {
      POST: safeHandler(async ({ request }) => {
        const input = await parseJson(request, GenerateRequestSchema)
        try {
          const response = await enqueueArticleGeneration(input.planItemId)
          const status = response.reused ? 200 : 202
          return json(response, { status })
        } catch (error) {
          if ((error as any)?.status) {
            return httpError((error as any).status, error instanceof Error ? error.message : 'Failed to enqueue article generation')
          }
          return httpError(500, 'Failed to enqueue article generation')
        }
      })
    }
  }
})
