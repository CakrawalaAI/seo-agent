// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, safeHandler } from '@app/api-utils'
import { planRepo } from '@entities/plan/repository'
import { hasDatabase, getDb } from '@common/infra/db'
import { planItems } from '@entities/plan/db/schema'
import { eq } from 'drizzle-orm'

export const Route = createFileRoute('/api/plan-items/$planItemId')({
  server: {
    handlers: {
      PUT: safeHandler(async ({ params, request }) => {
        const body = await request.json().catch(() => ({}))
        const plannedDate = body?.plannedDate
        if (typeof plannedDate !== 'string' || plannedDate.length !== 10) {
          return httpError(400, 'Invalid plannedDate')
        }
        if (hasDatabase()) {
          try { const db = getDb(); await db.update(planItems).set({ plannedDate, updatedAt: new Date() as any }).where(eq(planItems.id, params.planItemId)) } catch {}
        }
        const updated = planRepo.updateDate(params.planItemId, plannedDate)
        if (!updated) return httpError(404, 'Plan item not found')
        return json({ plannedDate: updated.plannedDate })
      })
    }
  }
})
