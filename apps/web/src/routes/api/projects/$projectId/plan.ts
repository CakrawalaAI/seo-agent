// @ts-nocheck
import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { listPlanItems } from '~/server/services/plan'
import { httpError, json, safeHandler } from '../../utils'

const PlanParamsSchema = z.object({
  projectId: z.string().min(1)
})

const PlanQuerySchema = z.object({
  status: z.enum(['planned', 'skipped', 'consumed']).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().optional()
})

export const Route = createFileRoute('/api/projects/$projectId/plan')({
  server: {
    handlers: {
      GET: safeHandler(async ({ params, request }) => {
        const { projectId } = PlanParamsSchema.parse(params)
        const url = new URL(request.url)
        const parsed = PlanQuerySchema.safeParse(Object.fromEntries(url.searchParams))
        if (!parsed.success) {
          return httpError(400, 'Invalid plan query', parsed.error.flatten())
        }

        const { status, from, to, cursor, limit } = parsed.data
        const response = await listPlanItems(projectId, { status, from, to, cursor, limit })
        return json(response)
      })
    }
  }
})
