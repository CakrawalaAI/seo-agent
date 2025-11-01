// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, safeHandler, requireSession } from '@app/api-utils'
import { getJob } from '@common/infra/jobs'

export const Route = createFileRoute('/api/jobs/$jobId')({
  server: {
    handlers: {
      GET: safeHandler(async ({ params, request }) => {
        await requireSession(request)
        const id = params.jobId
        const searchProjectId = new URL(request.url).searchParams.get('projectId') || undefined
        const job = await getJob(id, searchProjectId || undefined)
        if (!job) return httpError(404, 'Not found')
        return json(job)
      })
    }
  }
})
