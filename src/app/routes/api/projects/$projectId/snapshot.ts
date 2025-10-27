// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, httpError } from '../../utils'
import { projectsRepo } from '@entities/project/repository'

export const Route = createFileRoute('/api/projects/$projectId/snapshot')({
  server: {
    handlers: {
      GET: ({ params }) => {
        const project = projectsRepo.get(params.projectId)
        if (!project) return httpError(404, 'Project not found')
        return json({
          queueDepth: 0,
          planItems: [],
          integrations: [],
          crawlPages: [],
          keywords: [],
          latestDiscovery: null
        })
      }
    }
  }
})

