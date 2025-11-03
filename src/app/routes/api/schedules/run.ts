// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, safeHandler, requireSession, requireProjectAccess } from '@app/api-utils'
import { runDailySchedules } from '@common/scheduler/daily'

export const Route = createFileRoute('/api/schedules/run')({
  server: {
    handlers: {
      POST: safeHandler(async ({ request }) => {
        await requireSession(request)
        const body = await request.json().catch(() => ({}))
        const projectId = body?.projectId
        if (!projectId) return httpError(400, 'Missing projectId')
        await requireProjectAccess(request, String(projectId))
        const result = await runDailySchedules({ projectId: String(projectId) })
        return json({ result })
      })
    }
  }
})
