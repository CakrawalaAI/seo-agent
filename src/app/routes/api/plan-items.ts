// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, safeHandler, requireSession, requireProjectAccess } from '@app/api-utils'
import { planRepo } from '@entities/plan/repository'
import { hasDatabase, getDb } from '@common/infra/db'
import { articles } from '@entities/article/db/schema'
import { eq, and, asc, inArray, isNotNull } from 'drizzle-orm'

export const Route = createFileRoute('/api/plan-items')({
  server: {
    handlers: {
      GET: safeHandler(async ({ request }) => {
        const url = new URL(request.url)
        const projectId = url.searchParams.get('projectId')
        const limit = Number(url.searchParams.get('limit') || '90')
        if (!projectId) return httpError(400, 'Missing projectId')
        await requireSession(request)
        await requireProjectAccess(request, projectId)
        if (hasDatabase()) {
          try {
            const db = getDb()
            const rows = await db
              .select()
              .from(articles)
              .where(
                and(
                  eq(articles.projectId, projectId),
                  isNotNull(articles.plannedDate),
                  inArray(articles.status as any, ['queued', 'scheduled', 'published'] as any)
                )
              )
              .orderBy(asc(articles.plannedDate as any))
              .limit(Number.isFinite(limit) ? limit : 90)
            return json({
              items: rows.map((r: any) => ({
                id: r.id,
                projectId: r.projectId,
                keywordId: r.keywordId ?? null,
                title: r.title,
                plannedDate: r.plannedDate,
                status: r.status,
                outlineJson: r.outlineJson
              }))
            })
          } catch {}
        }
        const items = await planRepo.list(projectId, Number.isFinite(limit) ? limit : 90)
        return json({ items })
      }),
      POST: safeHandler(async ({ request }) => {
        await requireSession(request)
        const body = await request.json().catch(() => ({}))
        const projectId = body?.projectId
        const days = Number(body?.days ?? 30)
        if (!projectId || !Number.isFinite(days) || days <= 0) return httpError(400, 'Invalid input')
        await requireProjectAccess(request, String(projectId))
        const { jobId } = await planRepo.createPlan(String(projectId), days)
        return json({ jobId }, { status: 202 })
      })
    }
  }
})
