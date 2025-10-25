// @ts-nocheck
import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { startArticlePublish } from '~/server/services/articles'
import { httpError, parseJson, safeHandler, json } from '../../utils'

const PublishArticleSchema = z.object({
  integrationId: z.string().min(1)
})

export const Route = createFileRoute('/api/articles/$articleId/publish')({
  server: {
    handlers: {
      POST: safeHandler(async ({ params, request }) => {
        const input = await parseJson(request, PublishArticleSchema)

        try {
          const result = await startArticlePublish(params.articleId, input.integrationId)
          const status = result.reused ? 200 : 202
          return json(result, { status })
        } catch (error) {
          const code = (error as any)?.code
          if (code === 'not_found') {
            return httpError(404, 'Article not found')
          }
          if (code === 'integration_not_found') {
            return httpError(404, 'Integration not found')
          }
          if (code === 'integration_not_connected') {
            return httpError(409, 'Integration is not connected')
          }
          if (code === 'already_published') {
            return httpError(409, 'Article already published')
          }
          throw error
        }
      })
    }
  }
})
