// @ts-nocheck
import { UpdateProjectInputSchema } from '@seo-agent/domain'
import { createFileRoute } from '@tanstack/react-router'
import { getProject, updateProject } from '~/server/services/projects'
import { httpError, json, parseJson, safeHandler } from '../../utils'

export const Route = createFileRoute('/api/projects/$projectId/')({
  server: {
    handlers: {
      GET: safeHandler(async ({ params }) => {
        const project = await getProject(params.projectId)
        if (!project) {
          return httpError(404, 'Project not found')
        }
        return json(project)
      }),
      PATCH: safeHandler(async ({ params, request }) => {
        const input = await parseJson(request, UpdateProjectInputSchema)
        const project = await updateProject(params.projectId, input)
        if (!project) {
          return httpError(404, 'Project not found')
        }
        return json(project)
      })
    }
  }
})
