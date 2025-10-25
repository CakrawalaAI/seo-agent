// @ts-nocheck
import { CreateProjectInputSchema, CreateProjectResponseSchema, PaginatedResponseSchema, ProjectSchema } from '@seo-agent/domain'
import { createFileRoute } from '@tanstack/react-router'
import { createProject } from '~/server/services/orgs'
import { listProjects } from '~/server/services/projects'
import { json, parseJson, safeHandler } from './utils'

export const Route = createFileRoute('/api/projects')({
  server: {
    handlers: {
      GET: safeHandler(async ({ request }) => {
        const url = new URL(request.url)
        const orgId = url.searchParams.get('orgId') ?? undefined
        const projects = await listProjects(orgId || undefined)
        const payload = PaginatedResponseSchema(ProjectSchema).parse({ items: projects })
        return json(payload)
      }),
      POST: safeHandler(async ({ request }) => {
        const input = await parseJson(request, CreateProjectInputSchema)
        const result = await createProject(input)
        return json(CreateProjectResponseSchema.parse(result), { status: 201 })
      })
    }
  }
})
