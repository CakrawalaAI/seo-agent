// @ts-nocheck
import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { JobStatusSchema, JobTypeSchema, PaginatedResponseSchema, JobSchema } from '@seo-agent/domain'
import { listProjectJobs } from '~/server/services/jobs'
import { httpError, json, safeHandler } from '../../../utils'

const querySchema = z.object({
  type: JobTypeSchema.optional(),
  status: JobStatusSchema.optional(),
  limit: z.coerce.number().int().positive().max(100).default(20)
})

export const Route = createFileRoute('/api/projects/$projectId/jobs')({
  server: {
    handlers: {
      GET: safeHandler(async ({ params, request }) => {
        const projectId = params.projectId
        if (!projectId) {
          return httpError(400, 'Missing projectId')
        }
        const url = new URL(request.url, 'http://localhost')
        const query = querySchema.parse(Object.fromEntries(url.searchParams))
        const jobs = await listProjectJobs(projectId, {
          type: query.type,
          status: query.status,
          limit: query.limit
        })
        const payload = PaginatedResponseSchema(JobSchema).parse({ items: jobs })
        return json(payload)
      })
    }
  }
})
