// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, safeHandler, requireSession, requireWebsiteAccess } from '@app/api-utils'
import { planRepo } from '@entities/article/planner'
import { hasDatabase, getDb } from '@common/infra/db'
import { articles } from '@entities/article/db/schema'
import { eq, and, asc, inArray, isNotNull } from 'drizzle-orm'

export const Route = createFileRoute('/api/plan-items')({
  server: {
    handlers: {
      GET: safeHandler(async ({ request }) => {
        const url = new URL(request.url)
        const websiteId = url.searchParams.get('websiteId') || url.searchParams.get('projectId')
        const limit = Number(url.searchParams.get('limit') || '90')
        if (!websiteId) return httpError(400, 'Missing websiteId')
        await requireSession(request)
        await requireWebsiteAccess(request, websiteId)
        if (hasDatabase()) {
          try {
            const db = getDb()
            const rows = await db
              .select()
              .from(articles)
              .where(
                and(
                  eq((articles as any).websiteId, websiteId),
                  isNotNull((articles as any).scheduledDate),
                  inArray(articles.status as any, ['queued', 'scheduled', 'published'] as any)
                )
              )
              .orderBy(asc((articles as any).scheduledDate as any))
              .limit(Number.isFinite(limit) ? limit : 90)
            return json({
              items: rows.map((r: any) => ({
                id: r.id,
                projectId: r.websiteId,
                keywordId: r.keywordId ?? null,
                title: r.title,
                scheduledDate: (r as any).scheduledDate,
                status: r.status,
                outlineJson: r.outlineJson
              }))
            })
          } catch {}
        }
        const items = await planRepo.list(websiteId, Number.isFinite(limit) ? limit : 90)
        return json({ items })
      }),
      POST: safeHandler(async ({ request }) => {
        await requireSession(request)
        const body = await request.json().catch(() => ({}))
        const websiteId = body?.websiteId || body?.projectId
        const days = Number(body?.days ?? 30)
        if (!websiteId || !Number.isFinite(days) || days <= 0) return httpError(400, 'Invalid input')
        await requireWebsiteAccess(request, String(websiteId))
        const { jobId } = await planRepo.createPlan(String(websiteId), days)
        return json({ jobId }, { status: 202 })
      })
    }
  }
})
