// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { httpError, json, safeHandler } from '~/routes/api/utils'
import { getProjectSnapshot } from '~/server/services/projects'

export const Route = createFileRoute('/api/projects/$projectId/snapshot')({
  server: {
    handlers: {
      GET: safeHandler(async ({ params }) => {
        const snapshot = await getProjectSnapshot(params.projectId)
        if (!snapshot) {
          return httpError(404, 'Project not found')
        }
        return json(snapshot)
      })
    }
  }
})
