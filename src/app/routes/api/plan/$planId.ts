// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, safeHandler } from '../utils'
import { planRepo } from '@entities/plan/repository'

export const Route = createFileRoute('/api/plan/$planId')({
  server: {
    handlers: {
      PATCH: safeHandler(async ({ params, request }) => {
        const body = await request.json().catch(() => ({}))
        const plannedDate = body?.plannedDate
        if (typeof plannedDate !== 'string' || plannedDate.length !== 10) {
          return httpError(400, 'Invalid plannedDate')
        }
        const updated = planRepo.updateDate(params.planId, plannedDate)
        if (!updated) return httpError(404, 'Plan item not found')
        return json(updated)
      })
    }
  }
})

