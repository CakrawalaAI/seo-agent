// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, safeHandler, requireSession, requireWebsiteAccess } from '@app/api-utils'
import { articlesRepo } from '@entities/article/repository'
import { attachmentsRepo } from '@entities/article/repository.attachments'
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
                const attachments = await attachmentsRepo.listByArticle(params.articleId)
                return json({ article: found, attachments })
              }
            } catch {}
          }
          return httpError(404, 'Not found')
        }
        await requireWebsiteAccess(request, String((article as any).websiteId))
        const attachments = await attachmentsRepo.listByArticle(params.articleId)
        return json({ article, attachments })
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
        const attachments = await attachmentsRepo.listByArticle(params.articleId)
        return json({ article: updated, attachments })
      }),
      DELETE: safeHandler(async ({ params, request }) => {
        const article = await articlesRepo.get(params.articleId)
        let websiteId = article ? String((article as any).websiteId ?? (article as any).projectId ?? '') : ''
        if (!websiteId && hasDatabase()) {
          try {
            const db = getDb()
            const rows = await (db.select().from(articles).where(eq(articles.id, params.articleId)).limit(1) as any)
            const found = rows?.[0]
            if (found) {
              websiteId = String((found as any).websiteId || (found as any).projectId || '')
            }
          } catch {}
        }
        if (!websiteId) return httpError(404, 'Not found')
        await requireWebsiteAccess(request, websiteId)
        await articlesRepo.remove(params.articleId)
        if (hasDatabase()) {
          try {
            const db = getDb()
            await db.delete(articles).where(eq(articles.id, params.articleId))
          } catch {}
        }
        return json({ deleted: true })
      })
    }
  }
})
