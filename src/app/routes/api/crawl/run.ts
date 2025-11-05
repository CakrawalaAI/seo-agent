// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, safeHandler, requireSession, requireWebsiteAccess } from '@app/api-utils'
import { log } from '@src/common/logger'
import { retriggerCrawl } from '@features/crawl/server/retrigger'

export const Route = createFileRoute('/api/crawl/run')({
  server: {
    handlers: {
      POST: safeHandler(async ({ request }) => {
        const session = await requireSession(request)
        const body = await request.json().catch(() => ({}))
        const projectId = body?.websiteId || body?.projectId
        if (!projectId) return httpError(400, 'Missing websiteId')
        await requireWebsiteAccess(request, String(projectId))
        log.info('[api/crawl/run] request', { websiteId: String(projectId) })
        const result = await retriggerCrawl({
          websiteId: String(projectId),
          triggeredBy: session?.user?.email ?? null
        })

        const payload = {
          status: result.status,
          jobId: result.jobId,
          nextEligibleAt: result.nextEligibleAt
        }

        if (result.status === 'cooldown') {
          return json(payload, { status: 429 })
        }
        if (result.status === 'disabled') {
          return json(payload, { status: 503 })
        }
        return json(payload, { status: 202 })
      })
    }
  }
})
