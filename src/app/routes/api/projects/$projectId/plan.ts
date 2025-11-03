// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, requireSession, requireProjectAccess } from '@app/api-utils'
import { planRepo } from '@entities/plan/repository'
import { hasDatabase, getDb } from '@common/infra/db'
import { articles } from '@entities/article/db/schema'
import { and, eq, gte, lte, asc, inArray } from 'drizzle-orm'

export const Route = createFileRoute('/api/projects/$projectId/plan')({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        await requireSession(request)
        await requireProjectAccess(request, params.projectId)
        const url = new URL(request.url)
        const limit = Number(url.searchParams.get('limit') || '90')
        const from = url.searchParams.get('from') || undefined
        const to = url.searchParams.get('to') || undefined
        if (hasDatabase()) {
          try {
            const db = getDb()
            let where: any = and(eq(articles.projectId, params.projectId), inArray(articles.status as any, ['queued', 'scheduled', 'published'] as any))
            if (from) where = and(where, gte(articles.plannedDate as any, from))
            if (to) where = and(where, lte(articles.plannedDate as any, to))
            const rows = await db.select().from(articles).where(where).orderBy(asc(articles.plannedDate as any)).limit(Number.isFinite(limit) ? limit : 90)
            const items = (rows as any[]).map((r) => ({ id: r.id, projectId: r.projectId, keywordId: r.keywordId ?? null, title: r.title, plannedDate: r.plannedDate, status: r.status, outlineJson: r.outlineJson }))
            return json({ items })
          } catch {}
        }
        let items = await planRepo.list(params.projectId, Number.isFinite(limit) ? limit : 90)
        if (from || to) {
          items = items.filter((i: any) => (!from || i.plannedDate >= from) && (!to || i.plannedDate <= to))
        }
        return json({ items })
      }
    }
  }
})
