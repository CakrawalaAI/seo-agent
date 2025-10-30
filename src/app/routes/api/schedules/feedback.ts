// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, safeHandler, requireSession } from '@app/api-utils'
import { hasDatabase, getDb } from '@common/infra/db'
import { projects } from '@entities/project/db/schema'
import { publishJob, queueEnabled } from '@common/infra/queue'
import { eq } from 'drizzle-orm'

export const Route = createFileRoute('/api/schedules/feedback')({
  server: {
    handlers: {
      POST: safeHandler(async ({ request }) => {
        await requireSession(request)
        const body = await request.json().catch(() => ({}))
        const projectId = String(body?.projectId || '')
        if (!projectId) return json({ queued: 0 })
        if (queueEnabled()) {
          await publishJob({ type: 'feedback', payload: { projectId } })
          return json({ queued: 1 })
        }
        return json({ queued: 0 })
      })
    }
  }
})

