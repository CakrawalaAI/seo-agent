// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, safeHandler } from '@app/api-utils'
import { planRepo } from '@entities/plan/repository'
import { hasDatabase, getDb } from '@common/infra/db'
import { planItems } from '@entities/plan/db/schema'
import { eq } from 'drizzle-orm'

export const Route = createFileRoute('/api/plan/$planId')({
  server: {
    handlers: {
      PATCH: safeHandler(async ({ params, request }) => {
        const body = await request.json().catch(() => ({}))
        const update: any = { updatedAt: new Date() as any }
        const hasPlannedDate = typeof body?.plannedDate === 'string' && body.plannedDate.length === 10
        const hasTitle = typeof body?.title === 'string'
        const hasOutline = Array.isArray(body?.outline)
        const hasStatus = typeof body?.status === 'string'
        if (!hasPlannedDate && !hasTitle && !hasOutline && !hasStatus) {
          return httpError(400, 'No valid fields to update')
        }
        if (hasPlannedDate) update.plannedDate = body.plannedDate
        if (hasTitle) update.title = body.title
        if (hasOutline) update.outlineJson = body.outline
        if (hasStatus) update.status = body.status
        if (hasDatabase()) {
          try {
            const db = getDb()
            await db.update(planItems).set(update).where(eq(planItems.id, params.planId))
          } catch {}
        }
        let updated: any = null
        if (hasPlannedDate) updated = planRepo.updateDate(params.planId, body.plannedDate)
        if (hasTitle || hasOutline || hasStatus) {
          updated = planRepo.updateFields(params.planId, { title: hasTitle ? body.title : undefined, outlineJson: hasOutline ? body.outline : undefined, status: hasStatus ? body.status : undefined })
        }
        if (!updated) return httpError(404, 'Plan item not found')
        return json(updated)
      })
    }
  }
})
