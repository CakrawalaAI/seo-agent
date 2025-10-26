import { JobSchema, PaginatedResponseSchema } from '@seo-agent/domain'
import { createFileRoute } from '@tanstack/react-router'
import { listCrawlRuns } from '~/server/services/crawl'
import { json, safeHandler } from '../utils'

const parseLimit = (value: string | null) => {
  if (!value) return undefined
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : undefined
}

export const Route = createFileRoute('/api/crawl/runs')({
  server: {
    handlers: {
      GET: safeHandler(async ({ request }) => {
        const url = new URL(request.url)
        const projectId = url.searchParams.get('projectId') ?? undefined
        const cursor = url.searchParams.get('cursor') ?? undefined
        const limit = parseLimit(url.searchParams.get('limit'))

        const runs = await listCrawlRuns({ projectId, cursor, limit })
        const payload = PaginatedResponseSchema(JobSchema).parse(runs)
        return json(payload)
      })
    }
  }
})
