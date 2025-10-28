// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, safeHandler, requireSession, requireProjectAccess } from '@app/api-utils'
import { articlesRepo } from '@entities/article/repository'
import { hasDatabase, getDb } from '@common/infra/db'
import { articles } from '@entities/article/db/schema'
import { eq } from 'drizzle-orm'

export const Route = createFileRoute('/api/articles/$articleId/')({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        await requireSession(request)
        const article = articlesRepo.get(params.articleId)
        if (!article) {
          if (hasDatabase()) {
            try {
              const db = getDb()
              // @ts-ignore
              const rows = await (db.select().from(articles).where(eq(articles.id, params.articleId)).limit(1) as any)
              const found = rows?.[0]
              if (found) {
                await requireProjectAccess(request, String(found.projectId))
                return json(found)
              }
            } catch {}
          }
          return httpError(404, 'Not found')
        }
        await requireProjectAccess(request, String(article.projectId))
        return json(article)
      },
      PATCH: safeHandler(async ({ params, request }) => {
        const patch = await request.json().catch(() => ({}))
        const current = articlesRepo.get(params.articleId)
        if (!current) return httpError(404, 'Not found')
        await requireProjectAccess(request, String(current.projectId))
        if (hasDatabase()) {
          try {
            const db = getDb()
            await db.update(articles).set({ ...patch, updatedAt: new Date() as any }).where(eq(articles.id, params.articleId))
          } catch {}
        }
        const updated = articlesRepo.update(params.articleId, patch)
        if (!updated) return httpError(404, 'Not found')
        return json(updated)
      })
    }
  }
})
