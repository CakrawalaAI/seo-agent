// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, safeHandler, requireSession, requireProjectAccess } from '@app/api-utils'
import { articlesRepo } from '@entities/article/repository'
import { publishJob, queueEnabled } from '@common/infra/queue'

export const Route = createFileRoute('/api/articles/$articleId/enrich')({
  server: {
    handlers: {
      POST: safeHandler(async ({ params, request }) => {
        await requireSession(request)
        const art = await articlesRepo.get(params.articleId)
        if (!art) return httpError(404, 'Article not found')
        await requireProjectAccess(request, String(art.projectId))
        if (queueEnabled()) {
          await publishJob({ type: 'enrich', payload: { projectId: art.projectId, articleId: art.id } })
        }
        return json({ queued: true })
      })
    }
  }
})
