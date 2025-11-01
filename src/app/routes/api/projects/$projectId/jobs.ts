// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, safeHandler, requireSession, requireProjectAccess } from '@app/api-utils'
import { queueEnabled, publishJob } from '@common/infra/queue'
import { recordJobQueued, listJobs } from '@common/infra/jobs'
import { hasDatabase, getDb } from '@common/infra/db'
import { jobs } from '@entities/job/db/schema'
import { desc, eq } from 'drizzle-orm'

export const Route = createFileRoute('/api/projects/$projectId/jobs')({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        await requireSession(request)
        await requireProjectAccess(request, params.projectId)
        const url = new URL(request.url)
        const limit = Number(url.searchParams.get('limit') || '25')
        const type = url.searchParams.get('type') || undefined
        const status = url.searchParams.get('status') || undefined
        if (hasDatabase()) {
          try {
            const db = getDb()
            // @ts-ignore
            let q = db
              .select()
              .from(jobs)
              .where(eq(jobs.projectId, params.projectId))
              .orderBy(desc(jobs.queuedAt))
              .limit(Number.isFinite(limit) ? limit : 25) as any
            // naive filter application client-side if drizzle chain above doesn't allow conditional
            const rows = await q
            const filtered = rows.filter((r: any) => (!type || r.type === type) && (!status || r.status === status))
            return json({ items: filtered })
          } catch {}
        }
        const items = (await listJobs(params.projectId, Number.isFinite(limit) ? limit : 25)).filter((r) => (!type || r.type === type) && (!status || r.status === status))
        return json({ items })
      },
      POST: safeHandler(async ({ params, request }) => {
        await requireProjectAccess(request, params.projectId)
        const body = await request.json().catch(() => ({}))
        const type = String(body?.type || '')
        const payload = (body?.payload ?? {}) as Record<string, unknown>
        if (!type) return httpError(400, 'Missing type')
        console.info('[api/projects/:id/jobs] enqueue', { projectId: params.projectId, type, queueEnabled: queueEnabled() })
        if (queueEnabled()) {
          const jobId = await publishJob({ type: type as any, payload: { ...payload, projectId: params.projectId } })
          recordJobQueued(params.projectId, type, jobId)
          console.info('[api/projects/:id/jobs] queued', { projectId: params.projectId, type, jobId })
          return json({ id: jobId, status: 'queued' }, { status: 202 })
        }
        // Fallback: accept but no queue
        const jobId = `job_${Date.now().toString(36)}`
        recordJobQueued(params.projectId, type, jobId)
        console.warn('[api/projects/:id/jobs] queue disabled; accepted without enqueue', { projectId: params.projectId, type, jobId })
        return json({ id: jobId, status: 'queued' }, { status: 202 })
      })
    }
  }
})
