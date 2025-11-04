// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, safeHandler } from '@app/api-utils'
import { planRepo } from '@entities/article/planner'
import { hasDatabase, getDb } from '@common/infra/db'
import { articles } from '@entities/article/db/schema'
import { eq } from 'drizzle-orm'

export const Route = createFileRoute('/api/plan/$planId')({
  server: {
    handlers: {
      PATCH: safeHandler(async ({ params, request }) => {
        const body = await request.json().catch(() => ({}))
        const update: any = { updatedAt: new Date() as any }
        const hasScheduledDate = typeof body?.scheduledDate === 'string' && body.scheduledDate.length === 10
        const hasTitle = typeof body?.title === 'string'
        const hasOutline = Array.isArray(body?.outline)
        const hasStatus = typeof body?.status === 'string'
        if (!hasScheduledDate && !hasTitle && !hasOutline && !hasStatus) {
          return httpError(400, 'No valid fields to update')
        }
        if (hasScheduledDate) (update as any).scheduledDate = body.scheduledDate
        if (hasTitle) update.title = body.title
        if (hasOutline) update.outlineJson = body.outline
        if (hasStatus) update.status = body.status
        if (hasDatabase()) { try { const db = getDb(); await db.update(articles).set(update).where(eq(articles.id, params.planId)) } catch {} }
        let updated: any = null
        if (hasScheduledDate) updated = await planRepo.updateDate(params.planId, body.scheduledDate)
        if (hasTitle || hasOutline || hasStatus) updated = await planRepo.updateFields(params.planId, { title: hasTitle ? body.title : undefined, outlineJson: hasOutline ? body.outline : undefined, status: hasStatus ? body.status : undefined })
        if (!updated) return httpError(404, 'Plan item not found')
        return json(updated)
      })
    }
  }
})
