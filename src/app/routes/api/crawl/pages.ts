// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, httpError } from '../utils'
import { crawlRepo } from '@entities/crawl/repository'

export const Route = createFileRoute('/api/crawl/pages')({
  server: {
    handlers: {
      GET: ({ request }) => {
        const url = new URL(request.url)
        const projectId = url.searchParams.get('projectId')
        const limit = Number(url.searchParams.get('limit') || '100')
        if (!projectId) return httpError(400, 'Missing projectId')
        const items = crawlRepo.list(projectId, Number.isFinite(limit) ? limit : 100)
        return json({ items })
      }
    }
  }
})

