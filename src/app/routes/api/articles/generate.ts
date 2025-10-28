// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, safeHandler, requireSession, requireProjectAccess } from '@app/api-utils'
import { planRepo } from '@entities/plan/repository'
import { articlesRepo } from '@entities/article/repository'
import { hasDatabase, getDb } from '@common/infra/db'
import { planItems } from '@entities/plan/db/schema'
import { eq } from 'drizzle-orm'
import { queueEnabled, publishJob } from '@common/infra/queue'
import { orgs, orgUsage } from '@entities/org/db/schema'
import { recordJobQueued, recordJobCompleted } from '@common/infra/jobs'

export const Route = createFileRoute('/api/articles/generate')({
  server: {
    handlers: {
      POST: safeHandler(async ({ request }) => {
        await requireSession(request)
        const body = await request.json().catch(() => ({}))
        const planItemId = body?.planItemId
        if (!planItemId) return httpError(400, 'Missing planItemId')
        let projectId: string | null = null
        let title: string | null = null
        if (hasDatabase()) {
          try {
            const db = getDb()
            // @ts-ignore
            const rows = await (db.select().from(planItems).where(eq(planItems.id, String(planItemId))).limit(1) as any)
            const row = rows?.[0]
            if (row) {
              projectId = String(row.projectId)
              title = String(row.title)
            }
          } catch {}
        }
        let outline = null
        if (!projectId || !title) {
          const found = planRepo.findById(String(planItemId))
          if (!found) return httpError(404, 'Plan item not found')
          projectId = found.projectId
          title = found.item.title
          outline = found.item.outlineJson ?? null
        }
        await requireProjectAccess(request, String(projectId))
        // Enforce monthly post credits (seat-based): used < monthlyPostCredits
        if (hasDatabase()) {
          try {
            const db = getDb()
            const sess = await requireSession(request)
            const activeOrgId = sess.activeOrg?.id
            if (activeOrgId) {
              // @ts-ignore
              const rows = await (db.select().from(orgs).where(eq(orgs.id, activeOrgId)).limit(1) as any)
              const ent = rows?.[0]?.entitlementsJson
              const total = Number(ent?.monthlyPostCredits || 0)
              if (Number.isFinite(total) && total > 0) {
                // @ts-ignore
                const urows = await (db.select().from(orgUsage).where((orgUsage as any).orgId.eq(activeOrgId)).limit(1) as any)
                const used = Number(urows?.[0]?.postsUsed || 0)
                if (used >= total) return httpError(402, 'Monthly post credits exhausted')
                // Reserve one credit now (best-effort)
                try {
                  await db
                    .update(orgUsage)
                    .set({ postsUsed: used + 1, updatedAt: new Date() as any })
                    // @ts-ignore
                    .where((orgUsage as any).orgId.eq(activeOrgId))
                  const newUsed = used + 1
                  if (total > 0 && newUsed / total >= 0.9) {
                    console.warn('[billing] usage high', { orgId: activeOrgId, used: newUsed, total })
                  }
                } catch {}
              }
            }
          } catch {}
        }
        // If queue enabled, enqueue and return job id
        if (queueEnabled()) {
          const jobId = await publishJob({ type: 'generate', payload: { projectId: String(projectId), planItemId: String(planItemId) } })
          recordJobQueued(String(projectId), 'generate', jobId)
          return json({ jobId }, { status: 202 })
        }
        // No queue: generate immediately but still return a job id
        const jobId = `job_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
        recordJobQueued(String(projectId), 'generate', jobId)
        const draft = articlesRepo.createDraft({ projectId: String(projectId), planItemId: String(planItemId), title: String(title), outline: Array.isArray(outline) ? (outline as any) : undefined })
        recordJobCompleted(String(projectId), jobId, { articleId: draft.id })
        return json({ jobId, articleId: draft.id, status: draft.status }, { status: 202 })
      })
    }
  }
})
