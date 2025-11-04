// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, safeHandler, requireSession, requireWebsiteAccess } from '@app/api-utils'
import { keywordsRepo } from '@entities/keyword/repository'
import { enrichMetrics } from '@common/providers/metrics'
import { queueEnabled, publishJob } from '@common/infra/queue'
import { recordJobQueued } from '@common/infra/jobs'
import { log } from '@src/common/logger'

export const Route = createFileRoute('/api/keywords/generate')({
  server: {
    handlers: {
      POST: safeHandler(async ({ request }) => {
        await requireSession(request)
        const body = await request.json().catch(() => ({}))
        const projectId = body?.websiteId || body?.projectId
        const locale = body?.locale || 'en-US'
        const languageCode = typeof body?.languageCode === 'string' ? String(body.languageCode) : undefined
        const locationCode = Number.isFinite(Number(body?.locationCode)) ? Number(body.locationCode) : undefined
        if (!projectId) return httpError(400, 'Missing websiteId')
        await requireWebsiteAccess(request, String(projectId))
        log.info('[api/keywords/generate] request', { websiteId: String(projectId), locale: String(locale), queueEnabled: queueEnabled() })
        if (queueEnabled()) {
          const jobId = await publishJob({ type: 'generateKeywords', payload: { websiteId: String(projectId), locale: String(locale), languageCode, locationCode } })
          recordJobQueued(String(projectId), 'generateKeywords', jobId)
          log.info('[api/keywords/generate] queued', { websiteId: String(projectId), jobId })
          return json({ jobId }, { status: 202 })
        } else {
          // In DB-only + global-cache model, local generation path is deprecated; require queue
          return json({ jobId: null }, { status: 202 })
        }
      })
    }
  }
})
