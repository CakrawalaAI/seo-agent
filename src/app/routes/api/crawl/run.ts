// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, safeHandler } from '../utils'
import { crawlRepo } from '@entities/crawl/repository'

export const Route = createFileRoute('/api/crawl/run')({
  server: {
    handlers: {
      POST: safeHandler(async ({ request }) => {
        const body = await request.json().catch(() => ({}))
        const projectId = body?.projectId
        if (!projectId) return httpError(400, 'Missing projectId')
        const { jobId } = crawlRepo.seedRun(String(projectId))
        return json({ jobId }, { status: 202 })
      })
    }
  }
})

