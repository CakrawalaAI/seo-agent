// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, safeHandler, requireSession, requireAdmin } from '@app/api-utils'
import { hasDatabase, getDb } from '@common/infra/db'
import { projects } from '@entities/project/db/schema'
import { publishJob, queueEnabled } from '@common/infra/queue'

export const Route = createFileRoute('/api/schedules/crawl-weekly')({
  server: {
    handlers: {
      POST: safeHandler(async ({ request }) => {
        await requireSession(request)
        await requireAdmin(request)
        if (!hasDatabase()) return json({ queued: 0 })
        const db = getDb()
        // @ts-ignore
        const rows = (await db.select().from(projects).limit(1000)) as any
        let queued = 0
        if (queueEnabled()) {
          for (const p of rows) {
            await publishJob({ type: 'crawl', payload: { projectId: p.id } })
            queued++
          }
        }
        return json({ queued })
      })
    }
  }
})
