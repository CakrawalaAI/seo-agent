// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, requireSession, requireWebsiteAccess } from '@app/api-utils'
import { hasDatabase, getDb } from '@common/infra/db'
import { articles } from '@entities/article/db/schema'
import { and, eq, desc } from 'drizzle-orm'

export const Route = createFileRoute('/api/websites/$websiteId/articles')({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        await requireSession(request)
        await requireWebsiteAccess(request, params.websiteId)
        if (!hasDatabase()) return httpError(500, 'Database not available')
        const db = getDb()
        const rows = await db
          .select()
          .from(articles)
          .where(eq((articles as any).websiteId, params.websiteId))
          .orderBy(desc(articles.createdAt as any))
          .limit(120)
        return json({ items: rows })
      }
    }
  }
})
