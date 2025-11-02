// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, safeHandler, requireSession, requireProjectAccess } from '@app/api-utils'
import { keywordsRepo } from '@entities/keyword/repository'
import { planRepo } from '@entities/plan/repository'
import { hasDatabase, getDb } from '@common/infra/db'
import { keywords } from '@entities/keyword/db/schema'

export const Route = createFileRoute('/api/keywords/$keywordId')({
  server: {
    handlers: {
      PATCH: safeHandler(async ({ params, request }) => {
        await requireSession(request)
        const body = await request.json().catch(() => ({}))
        // we need projectId to check RBAC; read from DB
        let projId: string | null = null
        if (hasDatabase()) {
          try {
            const db = getDb()
            // @ts-ignore
            const rows = await (db.select({ projectId: (keywords as any).projectId }).from(keywords).where((keywords as any).id.eq(params.keywordId)).limit(1) as any)
            projId = rows?.[0]?.projectId ?? null
          } catch {}
        }
        if (projId) await requireProjectAccess(request, projId)
        const patch: any = {}
        if (body?.status !== undefined) patch.status = body.status
        if (body?.starred !== undefined) patch.starred = Boolean(body.starred)
        if (body?.scope !== undefined) patch.scope = body.scope
        if (hasDatabase() && Object.keys(patch).length) {
          try {
            const db = getDb()
            await db
              .update(keywords)
              .set({ ...patch, updatedAt: new Date() as any })
              // @ts-ignore
              .where((keywords as any).id.eq(params.keywordId))
          } catch {}
        }
        const updated = await keywordsRepo.update(params.keywordId, patch)
        if (projId && body?.scope !== undefined) {
          try {
            const { publishJob, queueEnabled } = await import('@common/infra/queue')
            const days = 30
            if (queueEnabled()) {
              await publishJob({ type: 'plan', payload: { projectId: projId, days } })
            } else {
              await planRepo.createPlan(projId, days)
            }
          } catch {}
        }
        if (!updated && !projId) return httpError(404, 'Keyword not found')
        return json(updated ?? { id: params.keywordId })
      }),
      DELETE: safeHandler(async ({ params, request }) => {
        await requireSession(request)
        let projId: string | null = null
        if (hasDatabase()) {
          try {
            const db = getDb()
            // @ts-ignore
            const rows = await (db.select({ projectId: (keywords as any).projectId }).from(keywords).where((keywords as any).id.eq(params.keywordId)).limit(1) as any)
            projId = rows?.[0]?.projectId ?? null
          } catch {}
        }
        if (projId) await requireProjectAccess(request, projId)
        if (hasDatabase()) {
          try {
            const db = getDb()
            // @ts-ignore
            await db.delete(keywords).where((keywords as any).id.eq(params.keywordId))
          } catch {}
        }
        const ok = await keywordsRepo.remove(params.keywordId)
        if (!ok && !projId) return httpError(404, 'Keyword not found')
        return new Response(null, { status: 204 })
      })
    }
  }
})
