// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, safeHandler, requireSession, requireProjectAccess } from '@app/api-utils'
import { crawlRepo } from '@entities/crawl/repository'
import { hasDatabase, getDb } from '@common/infra/db'
import { crawlPages } from '@entities/crawl/db/schema'
import { desc, eq } from 'drizzle-orm'
import { queueEnabled, publishJob } from '@common/infra/queue'
import { recordJobQueued } from '@common/infra/jobs'

export const Route = createFileRoute('/api/crawl/run')({
  server: {
    handlers: {
      POST: safeHandler(async ({ request }) => {
        requireSession(request)
        const body = await request.json().catch(() => ({}))
        const projectId = body?.projectId
        const force = body?.force === true
        if (!projectId) return httpError(400, 'Missing projectId')
        await requireProjectAccess(request, String(projectId))
        // Idempotency: skip if recent crawl exists
        if (!force) {
          const minDays = Math.max(1, Number(process.env.SEOA_CRAWL_MIN_INTERVAL_DAYS || '3'))
          const cutoff = Date.now() - minDays * 24 * 60 * 60 * 1000
          let recent = false
          if (hasDatabase()) {
            try {
              const db = getDb()
              // @ts-ignore
              const rows = await (db.select().from(crawlPages).where(eq(crawlPages.projectId, String(projectId))).orderBy(desc(crawlPages.extractedAt)).limit(1) as any)
              const last = rows?.[0]?.extractedAt ? new Date(rows[0].extractedAt).getTime() : 0
              if (last && last > cutoff) recent = true
            } catch {}
          }
          if (!recent) {
            const list = crawlRepo.list(String(projectId), 1)
            const last = list[0]?.extractedAt ? new Date(list[0].extractedAt as any).getTime() : 0
            if (last && last > cutoff) recent = true
          }
          if (recent) return json({ skipped: true, reason: 'recent_crawl' }, { status: 200 })
        }
        if (queueEnabled()) {
          const jobId = await publishJob({ type: 'crawl', payload: { projectId: String(projectId) } })
          recordJobQueued(String(projectId), 'crawl', jobId)
          return json({ jobId }, { status: 202 })
        } else {
          const { jobId } = crawlRepo.seedRun(String(projectId))
          return json({ jobId }, { status: 202 })
        }
      })
    }
  }
})
