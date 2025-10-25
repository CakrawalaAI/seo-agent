// @ts-nocheck
import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { UpdatePlanItemSchema } from '@seo-agent/domain'
import { updatePlanItem } from '~/server/services/plan'
import { httpError, json, parseJson, safeHandler } from '../utils'

const ParamsSchema = z.object({ planItemId: z.string().min(1) })

export const Route = createFileRoute('/api/plan-items/$planItemId')({
  server: {
    handlers: {
      PUT: safeHandler(async ({ params, request }) => {
        const { planItemId } = ParamsSchema.parse(params)
        const input = await parseJson(request, UpdatePlanItemSchema)
        const planItem = await updatePlanItem(planItemId, input)
        if (!planItem) {
          return httpError(404, 'Plan item not found')
        }
        return json(planItem)
      })
    }
  }
})
