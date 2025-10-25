// @ts-nocheck
import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { enqueueArticlePublish } from '~/server/services/articles'
import { httpError, json, parseJson, safeHandler } from '../../utils'

const PublishRequestSchema = z.object({
  integrationId: z.string().min(1)
})

const ParamsSchema = z.object({ articleId: z.string().min(1) })

export const Route = createFileRoute('/api/articles/$articleId/publish')({
  server: {
    handlers: {
      POST: safeHandler(async ({ params, request }) => {
        const { articleId } = ParamsSchema.parse(params)
        const input = await parseJson(request, PublishRequestSchema)
        try {
          const response = await enqueueArticlePublish(articleId, input.integrationId)
          const status = response.reused ? 200 : 202
          return json(response, { status })
        } catch (error) {
          if ((error as any)?.status) {
            return httpError(
              (error as any).status,
              error instanceof Error ? error.message : 'Failed to enqueue article publish'
            )
          }
          return httpError(500, 'Failed to enqueue article publish')
        }
      })
    }
  }
})
