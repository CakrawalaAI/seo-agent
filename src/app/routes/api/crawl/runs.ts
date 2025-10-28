// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, requireSession, requireProjectAccess } from '@app/api-utils'
import { discoveryRepo } from '@entities/discovery/repository'

export const Route = createFileRoute('/api/crawl/runs')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const projectId = url.searchParams.get('projectId')
        if (!projectId) return httpError(400, 'Missing projectId')
        await requireSession(request)
        await requireProjectAccess(request, String(projectId))
        const latest = discoveryRepo.latest(String(projectId))
        return json({ items: latest ? [latest] : [] })
      }
    }
  }
})
