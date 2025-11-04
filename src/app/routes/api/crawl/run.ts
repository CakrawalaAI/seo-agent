// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, safeHandler, requireSession, requireWebsiteAccess } from '@app/api-utils'
// DB-only: do not use bundle crawlRepo
import { queueEnabled, publishJob } from '@common/infra/queue'
import { recordJobQueued } from '@common/infra/jobs'
import { log } from '@src/common/logger'

export const Route = createFileRoute('/api/crawl/run')({
  server: {
    handlers: {
      POST: safeHandler(async ({ request }) => {
        await requireSession(request)
        const body = await request.json().catch(() => ({}))
        const projectId = body?.websiteId || body?.projectId
        const force = body?.force === true
        if (!projectId) return httpError(400, 'Missing websiteId')
        await requireWebsiteAccess(request, String(projectId))
        log.info('[api/crawl/run] request', { websiteId: String(projectId), force, queueEnabled: queueEnabled(), rabbit: process.env.RABBITMQ_URL ? 'set' : 'unset' })
        // Idempotency: skip if recent crawl exists
        // Idempotency checks TBD for DB-only; proceed to queue
        if (queueEnabled()) {
          const jobId = await publishJob({ type: 'crawl', payload: { websiteId: String(projectId) } })
          recordJobQueued(String(projectId), 'crawl', jobId)
          log.info('[api/crawl/run] queued', { websiteId: String(projectId), jobId })
          return json({ jobId }, { status: 202 })
        } else {
          // No local seeding in DB-only mode
          return json({ jobId: null }, { status: 202 })
        }
      })
    }
  }
})
