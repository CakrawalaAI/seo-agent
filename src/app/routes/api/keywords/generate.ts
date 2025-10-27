// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, safeHandler } from '../utils'
import { keywordsRepo } from '@entities/keyword/repository'

export const Route = createFileRoute('/api/keywords/generate')({
  server: {
    handlers: {
      POST: safeHandler(async ({ request }) => {
        const body = await request.json().catch(() => ({}))
        const projectId = body?.projectId
        const locale = body?.locale || 'en-US'
        if (!projectId) return httpError(400, 'Missing projectId')
        const { jobId } = keywordsRepo.generate(String(projectId), String(locale))
        return json({ jobId }, { status: 202 })
      })
    }
  }
})

