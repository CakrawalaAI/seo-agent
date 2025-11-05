// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, requireSession, requireWebsiteAccess } from '@app/api-utils'
import { getDb, hasDatabase } from '@common/infra/db'
import { crawlJobs, crawlPages } from '@entities/crawl/db/schema.website'
import { eq, desc } from 'drizzle-orm'

export const Route = createFileRoute('/api/websites/$websiteId/crawl-pages')({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        await requireSession(request)
        await requireWebsiteAccess(request, params.websiteId)
        if (!hasDatabase()) return httpError(501, 'Database not available')
        const db = getDb()
        const url = new URL(request.url)
        const limit = Math.max(1, Math.min(Number(url.searchParams.get('limit') || 200), 500))
        const includeContent = (url.searchParams.get('includeContent') || '0') === '1'

        const jobs = await db
          .select()
          .from(crawlJobs)
          .where(eq(crawlJobs.websiteId, params.websiteId))
          .orderBy(desc(crawlJobs.createdAt as any))
          .limit(1)
        const job = jobs[0]
        if (!job) return json({ items: [], jobId: null })

        const pages = await db
          .select()
          .from(crawlPages)
          .where(eq(crawlPages.jobId, job.id))
          .orderBy(desc(crawlPages.createdAt as any))
          .limit(limit)

        const items = pages.map((p: any) => ({
          id: p.id,
          jobId: p.jobId,
          url: p.url,
          httpStatus: p.httpStatus ?? null,
          title: p.title ?? null,
          summary: p.summary ?? null,
          createdAt: p.createdAt ? new Date(p.createdAt as any).toISOString() : null,
          content: includeContent ? (p.content ?? null) : undefined
        }))
        return json({ items, jobId: job.id })
      }
    }
  }
})

