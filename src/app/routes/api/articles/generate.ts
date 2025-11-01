import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, safeHandler, requireSession, requireProjectAccess } from '@app/api-utils'
import { planRepo } from '@entities/plan/repository'
import { articlesRepo } from '@entities/article/repository'
import { hasDatabase, getDb } from '@common/infra/db'
import { articles } from '@entities/article/db/schema'
import { eq } from 'drizzle-orm'
import { queueEnabled, publishJob } from '@common/infra/queue'
import { recordJobQueued, recordJobCompleted } from '@common/infra/jobs'
import { requirePostEntitlement } from '@common/infra/entitlements'
import { z } from 'zod'
import { parseJson } from '@common/http/validate'

export const Route = createFileRoute('/api/articles/generate')({
  server: {
    handlers: {
      POST: safeHandler(async ({ request }) => {
        const sess = await requireSession(request)
        const body = await parseJson(request, z.object({ planItemId: z.string().min(1) }))
        const planItemId = body.planItemId
        if (!planItemId) return httpError(400, 'Missing planItemId')

        // Fetch plan item
        let projectId: string | null = null
        let title: string | null = null
        let outline = null

        if (hasDatabase()) { try { const db = getDb(); const rows = await db.select().from(articles).where(eq(articles.id, String(planItemId))).limit(1); const row: any = rows?.[0]; if (row) { projectId = row.projectId as string; title = String(row.title || '') } } catch {} }

        if (!projectId || !title) {
          const found = await planRepo.findById(String(planItemId))
          if (!found) return httpError(404, 'Plan item not found')
          projectId = found.projectId
          title = found.item.title
          outline = found.item.outlineJson ?? null
        }

        await requireProjectAccess(request, String(projectId))

        // Enforce entitlements (centralized middleware)
        const activeOrgId = sess.activeOrg?.id
        if (activeOrgId) {
          const check = await requirePostEntitlement(activeOrgId)
          if (!check.allowed) {
            return httpError(429, check.reason || 'Monthly post limit exceeded')
          }

          const { usage, entitlements } = check
          if (entitlements.monthlyPostCredits > 0 && usage.postsUsed / entitlements.monthlyPostCredits >= 0.9) {
            console.warn('[Billing] Usage approaching limit', {
              orgId: activeOrgId,
              used: usage.postsUsed + 1,
              total: entitlements.monthlyPostCredits
            })
          }
        }

        // If queue enabled, enqueue and return job id
        if (queueEnabled()) {
          const jobId = await publishJob({
            type: 'generate',
            payload: { projectId: String(projectId), planItemId: String(planItemId) }
          })
          recordJobQueued(String(projectId), 'generate', jobId)
          return json({ jobId }, { status: 202 })
        }

        // No queue: generate immediately but still return a job id
        const jobId = `job_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
        recordJobQueued(String(projectId), 'generate', jobId)
        const draft = await articlesRepo.createDraft({
          projectId: String(projectId),
          planItemId: String(planItemId),
          title: String(title),
          outline: Array.isArray(outline) ? outline : undefined
        })
        recordJobCompleted(String(projectId), jobId, { articleId: draft.id })
        return json({ jobId, articleId: draft.id, status: draft.status }, { status: 202 })
      })
    }
  }
})
