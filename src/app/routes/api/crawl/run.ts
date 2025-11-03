// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, safeHandler, requireSession, requireProjectAccess } from '@app/api-utils'
import { crawlRepo } from '@entities/crawl/repository'
import { queueEnabled, publishJob } from '@common/infra/queue'
import { recordJobQueued } from '@common/infra/jobs'
import { log } from '@src/common/logger'

export const Route = createFileRoute('/api/crawl/run')({
  server: {
    handlers: {
      POST: safeHandler(async ({ request }) => {
        await requireSession(request)
        const body = await request.json().catch(() => ({}))
        const projectId = body?.projectId
        const force = body?.force === true
        if (!projectId) return httpError(400, 'Missing projectId')
        await requireProjectAccess(request, String(projectId))
        log.info('[api/crawl/run] request', { projectId: String(projectId), force, queueEnabled: queueEnabled(), rabbit: process.env.RABBITMQ_URL ? 'set' : 'unset' })
        // Idempotency: skip if recent crawl exists
        if (!force) {
          const minDays = 3
          const cutoff = Date.now() - minDays * 24 * 60 * 60 * 1000
          const list = await crawlRepo.list(String(projectId), 1)
          const last = list[0]?.extractedAt ? new Date(list[0].extractedAt as any).getTime() : 0
          const recent = Boolean(last && last > cutoff)
          if (recent) {
            log.info('[api/crawl/run] skipped recent crawl', { projectId: String(projectId) })
            return json({ skipped: true, reason: 'recent_crawl' }, { status: 200 })
          }
        }
        if (queueEnabled()) {
          const jobId = await publishJob({ type: 'crawl', payload: { projectId: String(projectId) } })
          recordJobQueued(String(projectId), 'crawl', jobId)
          log.info('[api/crawl/run] queued', { projectId: String(projectId), jobId })
          return json({ jobId }, { status: 202 })
        } else {
          const { jobId } = await crawlRepo.seedRun(String(projectId))
          log.warn('[api/crawl/run] queue disabled; seeded local crawl pages', { projectId: String(projectId), jobId })
          return json({ jobId }, { status: 202 })
        }
      })
    }
  }
})
