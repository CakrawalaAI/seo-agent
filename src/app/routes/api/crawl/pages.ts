// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, requireSession, requireProjectAccess } from '@app/api-utils'
import { crawlRepo } from '@entities/crawl/repository'

export const Route = createFileRoute('/api/crawl/pages')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const projectId = url.searchParams.get('projectId')
        const limit = Number(url.searchParams.get('limit') || '100')
        const q = url.searchParams.get('q') || ''
        if (!projectId) return httpError(400, 'Missing projectId')
        if (process.env.E2E_NO_AUTH !== '1') {
          await requireSession(request)
          await requireProjectAccess(request, String(projectId))
        }
        const items = await crawlRepo.list(projectId, Number.isFinite(limit) ? limit : 100)
        const filtered = q
          ? items.filter((r) => {
              const needle = q.toLowerCase()
              const urlMatch = String(r.url || '').toLowerCase().includes(needle)
              const titleMatch = String((r as any)?.metaJson?.title || '').toLowerCase().includes(needle)
              return urlMatch || titleMatch
            })
          : items
        return json({ items: filtered })
      }
    }
  }
})
