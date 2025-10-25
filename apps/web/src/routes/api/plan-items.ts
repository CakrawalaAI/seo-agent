// @ts-nocheck
import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { listPlanItems } from '~/server/services/plan'
import { httpError, json, safeHandler } from './utils'

const PlanQuerySchema = z.object({
  projectId: z.string().min(1),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().optional()
})

export const Route = createFileRoute('/api/plan-items')({
  server: {
    handlers: {
      GET: safeHandler(async ({ request }) => {
        const url = new URL(request.url)
        const parsed = PlanQuerySchema.safeParse(Object.fromEntries(url.searchParams))
        if (!parsed.success) {
          return httpError(400, 'Invalid query params', parsed.error.flatten())
        }

        const response = await listPlanItems(parsed.data.projectId, {
          cursor: parsed.data.cursor,
          limit: parsed.data.limit
        })
        return json(response)
      })
    }
  }
})
