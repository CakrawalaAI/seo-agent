// @ts-nocheck
import { UpdateArticleInputSchema } from '@seo-agent/domain'
import { createFileRoute } from '@tanstack/react-router'
import { getArticle, updateArticle } from '~/server/services/articles'
import { httpError, json, parseJson, safeHandler } from '../../utils'

export const Route = createFileRoute('/api/articles/$articleId/')({
  server: {
    handlers: {
      GET: safeHandler(async ({ params }) => {
        const article = await getArticle(params.articleId)
        if (!article) {
          return httpError(404, 'Article not found')
        }
        return json(article)
      }),
      PATCH: safeHandler(async ({ params, request }) => {
        const input = await parseJson(request, UpdateArticleInputSchema)
        const article = await updateArticle(params.articleId, input)
        if (!article) {
          return httpError(404, 'Article not found')
        }
        return json(article)
      })
    }
  }
})
