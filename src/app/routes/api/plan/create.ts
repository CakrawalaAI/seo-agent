// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, safeHandler, requireSession, requireProjectAccess } from '@app/api-utils'
import { planRepo } from '@entities/plan/repository'
import { queueEnabled, publishJob } from '@common/infra/queue'
import { recordJobQueued } from '@common/infra/jobs'

export const Route = createFileRoute('/api/plan/create')({
  server: {
    handlers: {
      POST: safeHandler(async ({ request }) => {
        requireSession(request)
        const body = await request.json().catch(() => ({}))
        const projectId = body?.projectId
        const days = Number(body?.days ?? 30)
        if (!projectId || !Number.isFinite(days) || days <= 0) return httpError(400, 'Invalid input')
        await requireProjectAccess(request, String(projectId))
        if (queueEnabled()) {
          const jobId = await publishJob({ type: 'plan', payload: { projectId: String(projectId), days } })
          recordJobQueued(String(projectId), 'plan', jobId)
          return json({ jobId }, { status: 202 })
        } else {
          const { jobId } = planRepo.createPlan(String(projectId), days)
          return json({ jobId }, { status: 202 })
        }
      })
    }
  }
})
