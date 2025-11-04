// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, requireSession, requireWebsiteAccess } from '@app/api-utils'
import { crawlRepo } from '@entities/crawl/repository'

export const Route = createFileRoute('/api/crawl/pages')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const projectId = url.searchParams.get('websiteId') || url.searchParams.get('projectId')
        const limit = Number(url.searchParams.get('limit') || '100')
        const q = url.searchParams.get('q') || ''
        if (!projectId) return httpError(400, 'Missing websiteId')
        if (process.env.E2E_NO_AUTH !== '1') {
          await requireSession(request)
          await requireWebsiteAccess(request, String(projectId))
        }
        const items = await crawlRepo.listRecentPages(projectId, Number.isFinite(limit) ? limit : 100)
        const filtered = q
          ? items.filter((r: any) => {
              const needle = q.toLowerCase()
              const urlMatch = String(r.url || '').toLowerCase().includes(needle)
              const titleMatch = String((r as any)?.title || '').toLowerCase().includes(needle)
              return urlMatch || titleMatch
            })
          : items
        return json({ items: filtered })
      }
    }
  }
})
