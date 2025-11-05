// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, safeHandler, requireSession, requireWebsiteAccess } from '@app/api-utils'
import { planRepo } from '@entities/article/planner'
import { hasDatabase, getDb } from '@common/infra/db'
import { articles } from '@entities/article/db/schema'
import { eq, and, asc, inArray, isNotNull } from 'drizzle-orm'
import { websitesRepo } from '@entities/website/repository'
import { getEntitlements } from '@common/infra/entitlements'

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

        const website = await websitesRepo.get(String(websiteId))
        if (!website) return httpError(404, 'Website not found')

        const boundedDays = await computeAllowedPlanDays(website.orgId, days)
        if (boundedDays <= 0) {
          return httpError(403, 'Extend subscription to schedule more content')
        }

        const { jobId } = await planRepo.createPlan(String(websiteId), boundedDays)
        return json({ jobId }, { status: 202 })
      })
    }
  }
})

async function computeAllowedPlanDays(orgId: string | null | undefined, requestedDays: number): Promise<number> {
  if (!orgId) return Math.max(1, Math.min(90, Math.floor(requestedDays)))
  try {
    const entitlements = await getEntitlements(orgId)
    if (!entitlements) return Math.max(1, Math.min(90, Math.floor(requestedDays)))

    const today = startOfUtcDay(new Date())
    const caps: Date[] = []
    const addCap = (value: string | null | undefined) => {
      if (!value) return
      const parsed = new Date(value)
      if (!Number.isNaN(parsed.getTime())) caps.push(startOfUtcDay(parsed))
    }

    addCap((entitlements.trial as any)?.outlinesThrough)
    addCap(entitlements.trialEndsAt)
    addCap(entitlements.activeUntil)

    if (!caps.length) return Math.max(1, Math.min(90, Math.floor(requestedDays)))
    const minCap = caps.sort((a, b) => a.getTime() - b.getTime())[0]
    const allowed = differenceInDaysInclusive(minCap, today)
    if (allowed <= 0) return 0
    return Math.max(1, Math.min(allowed, Math.min(90, Math.floor(requestedDays))))
  } catch {
    return Math.max(1, Math.min(90, Math.floor(requestedDays)))
  }
}

function startOfUtcDay(date: Date): Date {
  const copy = new Date(date)
  copy.setUTCHours(0, 0, 0, 0)
  return copy
}

function differenceInDaysInclusive(end: Date, start: Date): number {
  const diffMs = startOfUtcDay(end).getTime() - startOfUtcDay(start).getTime()
  if (diffMs < 0) return 0
  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000)) + 1
  return days
}
