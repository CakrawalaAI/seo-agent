import { CrawlPageSchema, PaginatedResponseSchema } from '@seo-agent/domain'
import { createFileRoute } from '@tanstack/react-router'
import { listCrawlPages } from '~/server/services/crawl'
import { httpError, json, safeHandler } from '../utils'

const parseLimit = (value: string | null) => {
  if (!value) return undefined
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : undefined
}

export const Route = createFileRoute('/api/crawl/pages')({
  server: {
    handlers: {
      GET: safeHandler(async ({ request }) => {
        const url = new URL(request.url)
        const projectId = url.searchParams.get('projectId')
        if (!projectId) {
          return httpError(400, 'projectId is required')
        }
        const cursor = url.searchParams.get('cursor') ?? undefined
        const limit = parseLimit(url.searchParams.get('limit'))
        const query = url.searchParams.get('q') ?? undefined

        const pages = await listCrawlPages({ projectId, cursor, limit, query })
        const payload = PaginatedResponseSchema(CrawlPageSchema).parse(pages)
        return json(payload)
      })
    }
  }
})
