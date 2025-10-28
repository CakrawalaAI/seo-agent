// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, safeHandler } from '@app/api-utils'
import { planRepo } from '@entities/plan/repository'
import { hasDatabase, getDb } from '@common/infra/db'
import { planItems } from '@entities/plan/db/schema'
import { eq } from 'drizzle-orm'

export const Route = createFileRoute('/api/plan-items')({
  server: {
    handlers: {
      GET: safeHandler(async ({ request }) => {
        const url = new URL(request.url)
        const projectId = url.searchParams.get('projectId')
        const limit = Number(url.searchParams.get('limit') || '90')
        if (!projectId) return httpError(400, 'Missing projectId')
        if (hasDatabase()) {
          try {
            const db = getDb()
            // @ts-ignore
            const rows = await (db.select().from(planItems).where(eq(planItems.projectId, projectId)).limit(Number.isFinite(limit) ? limit : 90) as any)
            return json({ items: rows })
          } catch {}
        }
        const items = planRepo.list(projectId, Number.isFinite(limit) ? limit : 90)
        return json({ items })
      }),
      POST: safeHandler(async ({ request }) => {
        const body = await request.json().catch(() => ({}))
        const projectId = body?.projectId
        const days = Number(body?.days ?? 30)
        if (!projectId || !Number.isFinite(days) || days <= 0) return httpError(400, 'Invalid input')
        const { jobId } = planRepo.createPlan(String(projectId), days)
        return json({ jobId }, { status: 202 })
      })
    }
  }
})
