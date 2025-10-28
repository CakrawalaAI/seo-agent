// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@app/api-utils'
import { planRepo } from '@entities/plan/repository'
import { hasDatabase, getDb } from '@common/infra/db'
import { planItems } from '@entities/plan/db/schema'
import { and, eq, gte, lte } from 'drizzle-orm'

export const Route = createFileRoute('/api/projects/$projectId/plan')({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const url = new URL(request.url)
        const limit = Number(url.searchParams.get('limit') || '90')
        const from = url.searchParams.get('from') || undefined
        const to = url.searchParams.get('to') || undefined
        if (hasDatabase()) {
          try {
            const db = getDb()
            // @ts-ignore
            let where = eq(planItems.projectId, params.projectId)
            // @ts-ignore
            if (from) where = and(where, gte(planItems.plannedDate, from))
            // @ts-ignore
            if (to) where = and(where, lte(planItems.plannedDate, to))
            // @ts-ignore
            const rows = await (db.select().from(planItems).where(where).limit(Number.isFinite(limit) ? limit : 90) as any)
            return json({ items: rows })
          } catch {}
        }
        let items = planRepo.list(params.projectId, Number.isFinite(limit) ? limit : 90)
        if (from || to) {
          items = items.filter((i: any) => (!from || i.plannedDate >= from) && (!to || i.plannedDate <= to))
        }
        return json({ items })
      }
    }
  }
})
