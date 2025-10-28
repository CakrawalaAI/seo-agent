// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, requireSession, requireProjectAccess } from '@app/api-utils'
import { crawlRepo } from '@entities/crawl/repository'
import { hasDatabase, getDb } from '@common/infra/db'
import { crawlPages } from '@entities/crawl/db/schema'
import { eq } from 'drizzle-orm'

export const Route = createFileRoute('/api/crawl/pages')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const projectId = url.searchParams.get('projectId')
        const limit = Number(url.searchParams.get('limit') || '100')
        const q = url.searchParams.get('q') || ''
        if (!projectId) return httpError(400, 'Missing projectId')
        requireSession(request)
        await requireProjectAccess(request, String(projectId))
        if (hasDatabase()) {
          try {
            const db = getDb()
            // @ts-ignore
            const rows = await (db.select().from(crawlPages).where(eq(crawlPages.projectId, projectId)).limit(Number.isFinite(limit) ? limit : 100) as any)
            const filtered = q ? rows.filter((r: any) => String(r.url || '').includes(q) || String(r?.metaJson?.title || '').includes(q)) : rows
            return json({ items: filtered })
          } catch {}
        }
        const items = crawlRepo.list(projectId, Number.isFinite(limit) ? limit : 100).filter((r: any) => !q || r.url.includes(q) || String((r as any)?.metaJson?.title || '').includes(q))
        return json({ items })
      }
    }
  }
})
