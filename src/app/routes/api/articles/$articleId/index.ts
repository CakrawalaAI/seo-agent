// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, safeHandler, requireSession, requireWebsiteAccess } from '@app/api-utils'
import { articlesRepo } from '@entities/article/repository'
import { hasDatabase, getDb } from '@common/infra/db'
import { articles } from '@entities/article/db/schema'
import { eq } from 'drizzle-orm'

export const Route = createFileRoute('/api/articles/$articleId/')({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        await requireSession(request)
        const article = await articlesRepo.get(params.articleId)
        if (!article) {
          if (hasDatabase()) {
            try {
              const db = getDb()
              const rows = await (db.select().from(articles).where(eq(articles.id, params.articleId)).limit(1) as any)
              const found = rows?.[0]
              if (found) {
                await requireWebsiteAccess(request, String((found as any).websiteId || (found as any).projectId))
                return json(found)
              }
            } catch {}
          }
          return httpError(404, 'Not found')
        }
        await requireWebsiteAccess(request, String((article as any).websiteId))
        return json(article)
      },
      PATCH: safeHandler(async ({ params, request }) => {
        const patch = await request.json().catch(() => ({}))
        const current = await articlesRepo.get(params.articleId)
        if (!current) return httpError(404, 'Not found')
        await requireWebsiteAccess(request, String((current as any).websiteId))
        if (hasDatabase()) {
          try {
            const db = getDb()
            await db.update(articles).set({ ...patch, updatedAt: new Date() as any }).where(eq(articles.id, params.articleId))
          } catch {}
        }
        const updated = await articlesRepo.update(params.articleId, patch)
        if (!updated) return httpError(404, 'Not found')
        return json(updated)
      })
    }
  }
})

