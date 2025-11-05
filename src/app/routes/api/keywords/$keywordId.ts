// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, safeHandler, requireSession, requireWebsiteAccess } from '@app/api-utils'
import { planRepo } from '@entities/article/planner'
import { hasDatabase, getDb } from '@common/infra/db'
import { keywords } from '@entities/keyword/db/schema.keywords'
import { eq } from 'drizzle-orm'

export const Route = createFileRoute('/api/keywords/$keywordId')({
  server: {
    handlers: {
      PATCH: safeHandler(async ({ params, request }) => {
        await requireSession(request)
        const body = await request.json().catch(() => ({}))
        // we need projectId to check RBAC; read from DB
        let websiteId: string | null = null
        if (hasDatabase()) {
          try {
            const db = getDb()
            const rows = await db.select({ websiteId: keywords.websiteId }).from(keywords).where(eq(keywords.id, params.keywordId)).limit(1)
            websiteId = rows?.[0]?.websiteId ?? null
          } catch {}
        }
        if (websiteId) await requireWebsiteAccess(request, websiteId)
        const patch: any = {}
        if (body?.starred !== undefined) patch.starred = Boolean(body.starred) ? 1 : 0
        if (body?.active !== undefined) patch.active = Boolean(body.active)
        if (hasDatabase() && Object.keys(patch).length) {
          try {
            const db = getDb()
            await db.update(keywords).set({ ...patch, updatedAt: new Date() as any }).where(eq(keywords.id, params.keywordId))
          } catch {}
        }
        if (websiteId && (body?.scope !== undefined || body?.active !== undefined)) {
          try {
            const { publishJob, queueEnabled } = await import('@common/infra/queue')
            const days = 30
            if (queueEnabled()) {
              await publishJob({ type: 'plan', payload: { projectId: websiteId, days } })
            } else {
              await planRepo.createPlan(websiteId, days)
            }
          } catch {}
        }
        if (!websiteId) return httpError(404, 'Keyword not found')
        return json({ id: params.keywordId, websiteId, ...patch })
      }),
      DELETE: safeHandler(async ({ params, request }) => {
        await requireSession(request)
        let websiteId: string | null = null
        if (hasDatabase()) {
          try {
            const db = getDb()
            const rows = await db.select({ websiteId: keywords.websiteId }).from(keywords).where(eq(keywords.id, params.keywordId)).limit(1)
            websiteId = rows?.[0]?.websiteId ?? null
          } catch {}
        }
        if (websiteId) await requireWebsiteAccess(request, websiteId)
        if (hasDatabase()) {
          try {
            const db = getDb()
            await db.delete(keywords).where(eq(keywords.id, params.keywordId))
          } catch {}
        }
        if (!websiteId) return httpError(404, 'Keyword not found')
        return new Response(null, { status: 204 })
      })
    }
  }
})
