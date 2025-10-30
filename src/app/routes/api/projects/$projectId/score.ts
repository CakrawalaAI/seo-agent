// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, safeHandler, requireSession, requireProjectAccess } from '@app/api-utils'
import { queueEnabled, publishJob } from '@common/infra/queue'
import { recordJobQueued } from '@common/infra/jobs'

export const Route = createFileRoute('/api/projects/$projectId/score')({
  server: {
    handlers: {
      POST: safeHandler(async ({ params, request }) => {
        await requireSession(request)
        await requireProjectAccess(request, params.projectId)
        if (!queueEnabled()) return json({ jobId: null, queued: false }, { status: 202 })
        const jobId = await publishJob({ type: 'score', payload: { projectId: params.projectId } })
        recordJobQueued(params.projectId, 'score', jobId)
        return json({ jobId, queued: true }, { status: 202 })
      })
    }
  }
})

