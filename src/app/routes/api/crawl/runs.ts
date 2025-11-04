// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, requireSession, requireWebsiteAccess } from '@app/api-utils'
import { hasDatabase, getDb } from '@common/infra/db'
import { eq, desc } from 'drizzle-orm'
import { crawlRuns } from '@entities/crawl/db/schema.website'

export const Route = createFileRoute('/api/crawl/runs')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const projectId = url.searchParams.get('websiteId') || url.searchParams.get('projectId')
        if (!projectId) return httpError(400, 'Missing websiteId')
        await requireSession(request)
        await requireWebsiteAccess(request, String(projectId))
        if (!hasDatabase()) return json({ items: [] })
        try {
          const db = getDb()
          const rows = await db
            .select()
            .from(crawlRuns)
            .where(eq(crawlRuns.websiteId, String(projectId)))
            .orderBy(desc(crawlRuns.createdAt as any))
            .limit(50)
          return json({ items: rows })
        } catch {
          return json({ items: [] })
        }
      }
    }
  }
})
