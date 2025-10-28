// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, safeHandler, requireSession, requireProjectAccess } from '@app/api-utils'
import { keywordsRepo } from '@entities/keyword/repository'
import { enrichMetrics } from '@common/providers/metrics'
import { queueEnabled, publishJob } from '@common/infra/queue'
import { recordJobQueued } from '@common/infra/jobs'

export const Route = createFileRoute('/api/keywords/generate')({
  server: {
    handlers: {
      POST: safeHandler(async ({ request }) => {
        await requireSession(request)
        const body = await request.json().catch(() => ({}))
        const projectId = body?.projectId
        const locale = body?.locale || 'en-US'
        if (!projectId) return httpError(400, 'Missing projectId')
        await requireProjectAccess(request, String(projectId))
        if (queueEnabled()) {
          const jobId = await publishJob({ type: 'discovery', payload: { projectId: String(projectId), locale: String(locale) } })
          recordJobQueued(String(projectId), 'discovery', jobId)
          return json({ jobId }, { status: 202 })
        } else {
          const { jobId } = keywordsRepo.generate(String(projectId), String(locale))
          // Enrich metrics via provider (no-op if repo already set)
          const current = keywordsRepo.list(String(projectId), { status: 'all', limit: 100 })
          const enriched = await enrichMetrics(current.map((k) => ({ phrase: k.phrase })), String(locale), undefined, String(projectId))
          keywordsRepo.upsertMetrics(String(projectId), enriched)
          return json({ jobId }, { status: 202 })
        }
      })
    }
  }
})
