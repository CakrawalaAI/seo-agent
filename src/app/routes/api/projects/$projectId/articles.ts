// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, requireSession, requireProjectAccess } from '@app/api-utils'
import { articlesRepo } from '@entities/article/repository'
import { hasDatabase, getDb } from '@common/infra/db'
import { articles } from '@entities/article/db/schema'
import { desc, eq } from 'drizzle-orm'

export const Route = createFileRoute('/api/projects/$projectId/articles')({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        await requireSession(request)
        await requireProjectAccess(request, params.projectId)
        const url = new URL(request.url)
        const limit = Number(url.searchParams.get('limit') || '90')
        if (hasDatabase()) {
          try {
            const db = getDb()
            // @ts-ignore
            const rows = await (db
              .select()
              .from(articles)
              .where(eq(articles.projectId, params.projectId))
              .orderBy(desc(articles.createdAt))
              .limit(Number.isFinite(limit) ? limit : 90) as any)
            return json({ items: rows })
          } catch {}
        }
        const items = articlesRepo.list(params.projectId, Number.isFinite(limit) ? limit : 90)
        return json({ items })
      }
    }
  }
})
