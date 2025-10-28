// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, safeHandler, requireSession } from '@app/api-utils'
import { getJob } from '@common/infra/jobs'
import { hasDatabase, getDb } from '@common/infra/db'
import { jobs } from '@entities/job/db/schema'
import { eq } from 'drizzle-orm'

export const Route = createFileRoute('/api/jobs/$jobId')({
  server: {
    handlers: {
      GET: safeHandler(async ({ params, request }) => {
        await requireSession(request)
        const id = params.jobId
        if (hasDatabase()) {
          try {
            const db = getDb()
            // @ts-ignore
            const rows = await (db.select().from(jobs).where(eq(jobs.id, id)).limit(1) as any)
            const row = rows?.[0]
            if (row) return json(row)
          } catch {}
        }
        const job = getJob(id)
        if (!job) return httpError(404, 'Not found')
        return json(job)
      })
    }
  }
})
