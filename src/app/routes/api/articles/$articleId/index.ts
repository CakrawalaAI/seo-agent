// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, safeHandler } from '../../utils'
import { articlesRepo } from '@entities/article/repository'

export const Route = createFileRoute('/api/articles/$articleId/')({
  server: {
    handlers: {
      GET: ({ params }) => {
        const article = articlesRepo.get(params.articleId)
        if (!article) return httpError(404, 'Not found')
        return json(article)
      },
      PATCH: safeHandler(async ({ params, request }) => {
        const patch = await request.json().catch(() => ({}))
        const updated = articlesRepo.update(params.articleId, patch)
        if (!updated) return httpError(404, 'Not found')
        return json(updated)
      })
    }
  }
})

