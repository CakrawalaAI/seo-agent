// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, safeHandler, requireSession, requireWebsiteAccess } from '@app/api-utils'
import { runDailySchedules } from '@common/scheduler/daily'

export const Route = createFileRoute('/api/schedules/run')({
  server: {
    handlers: {
      POST: safeHandler(async ({ request }) => {
        await requireSession(request)
        const body = await request.json().catch(() => ({}))
        const websiteId = body?.websiteId || body?.projectId
        if (!websiteId) return httpError(400, 'Missing websiteId')
        await requireWebsiteAccess(request, String(websiteId))
        const result = await runDailySchedules({ websiteId: String(websiteId) })
        return json({ result })
      })
    }
  }
})
