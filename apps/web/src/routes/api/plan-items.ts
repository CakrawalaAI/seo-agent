// @ts-nocheck
import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { CreatePlanRequestSchema, PlanItemStatusSchema } from '@seo-agent/domain'
import { createPlan, listPlanItems } from '~/server/services/plan'
import { httpError, json, parseJson, safeHandler } from './utils'

const PlanQuerySchema = z.object({
  projectId: z.string().min(1),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().optional(),
  status: PlanItemStatusSchema.optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional()
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
          limit: parsed.data.limit,
          status: parsed.data.status,
          from: parsed.data.from,
          to: parsed.data.to
        })
        return json(response)
      }),
      POST: safeHandler(async ({ request }) => {
        const input = await parseJson(request, CreatePlanRequestSchema)
        try {
          const result = await createPlan(input)
          return json(result, { status: 202 })
        } catch (error) {
          const status = (error as any)?.status ?? 500
          const message = error instanceof Error ? error.message : 'Failed to enqueue plan job'
          return httpError(status, message)
        }
      })
    }
  }
})
