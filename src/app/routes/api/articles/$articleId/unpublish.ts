import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, safeHandler, requireSession, requireWebsiteAccess } from '@app/api-utils'
import { articlesRepo } from '@entities/article/repository'
import { attachmentsRepo } from '@entities/article/repository.attachments'

export const Route = createFileRoute('/api/articles/$articleId/unpublish')({
  server: {
    handlers: {
      POST: safeHandler(async ({ params, request }) => {
        await requireSession(request)
        const article = await articlesRepo.get(params.articleId)
        if (!article) return httpError(404, 'Article not found')
        const websiteId = String((article as any).websiteId ?? (article as any).projectId ?? '')
        if (!websiteId) return httpError(404, 'Article not found')
        await requireWebsiteAccess(request, websiteId)
        const updated = await articlesRepo.update(params.articleId, {
          status: 'unpublished',
          publishDate: null,
          url: null,
          cmsExternalId: null
        })
        if (!updated) return httpError(500, 'Failed to unpublish')
        const attachments = await attachmentsRepo.listByArticle(params.articleId)
        return json({ article: updated, attachments })
      })
    }
  }
})
