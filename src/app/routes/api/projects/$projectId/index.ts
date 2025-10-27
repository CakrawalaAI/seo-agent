// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, safeHandler } from '../../utils'
import { projectsRepo } from '@entities/project/repository'

export const Route = createFileRoute('/api/projects/$projectId')({
  server: {
    handlers: {
      GET: safeHandler(({ params }) => {
        const project = projectsRepo.get(params.projectId)
        if (!project) return httpError(404, 'Project not found')
        return json(project)
      }),
      PATCH: safeHandler(async ({ params, request }) => {
        const body = await request.json().catch(() => ({}))
        const updated = projectsRepo.patch(params.projectId, body)
        if (!updated) return httpError(404, 'Project not found')
        return json(updated)
      })
    }
  }
})

