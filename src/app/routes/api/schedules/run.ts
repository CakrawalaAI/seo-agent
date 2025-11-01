// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, safeHandler, requireSession, requireProjectAccess } from '@app/api-utils'
import { planRepo } from '@entities/plan/repository'
import { articlesRepo } from '@entities/article/repository'
import { integrationsRepo } from '@entities/integration/repository'
import { env } from '@common/infra/env'
import { hasDatabase, getDb } from '@common/infra/db'
import { projects } from '@entities/project/db/schema'
import { eq } from 'drizzle-orm'
// Use connector-based publish via job queue
import { queueEnabled, publishJob } from '@common/infra/queue'

export const Route = createFileRoute('/api/schedules/run')({
  server: {
    handlers: {
      POST: safeHandler(async ({ request }) => {
        await requireSession(request)
        const body = await request.json().catch(() => ({}))
        const projectId = body?.projectId
        if (!projectId) return httpError(400, 'Missing projectId')
        await requireProjectAccess(request, String(projectId))
        const today = new Date().toISOString().slice(0, 10)
        // Credits gating removed (org_usage dropped)
        let remainingCredits = Infinity
        // project-level policy overrides env
        let policy = env.autopublishPolicy
        let bufferDays = env.bufferDays
        if (hasDatabase()) {
          try {
            const db = getDb()
            // @ts-ignore
            const rows = await (db.select().from(projects).where(eq(projects.id, String(projectId))).limit(1) as any)
            const row = rows?.[0]
            if (row) {
              if (row.autoPublishPolicy) policy = String(row.autoPublishPolicy)
              if (typeof row.bufferDays === 'number') bufferDays = Number(row.bufferDays)
            }
          } catch {}
        }
        const plan = await planRepo.list(String(projectId), 365)
        const existingList = await articlesRepo.list(String(projectId), 999)
        const existing = new Map(existingList.map((a) => [a.planItemId ?? a.id, a]))
        let generatedDrafts = 0
        let publishedArticles = 0
        for (const item of plan) {
          if (item.plannedDate === today && !existing.has(item.id)) {
            if (generatedDrafts >= remainingCredits) continue
            // Create lightweight draft and queue provider-backed generation
            try {
              await articlesRepo.createDraft({ projectId: String(projectId), planItemId: item.id, title: item.title })
              generatedDrafts++
            } catch (e) {
              if ((e as Error)?.message === 'credit_exceeded') {
                console.warn('[api/schedules/run] credit exceeded; stopping draft generation')
                break
              }
              throw e
            }
            if (queueEnabled()) {
              const jobId = await publishJob({ type: 'generate', payload: { projectId: String(projectId), planItemId: item.id } })
              console.info('[api/schedules/run] queued generate', { projectId: String(projectId), planItemId: item.id, jobId })
            } else {
              console.warn('[api/schedules/run] queue disabled; skipped provider generate job', { projectId: String(projectId), planItemId: item.id })
            }
          }
        }

        // Autopublish pathway (buffered or manual publish window)
        // Publish only drafts with sufficient body (avoid placeholder-only) and buffer window satisfied
        const integrations = await integrationsRepo.list(String(projectId))
        const target = integrations.find((i) => i.status === 'connected' && env.publicationAllowed.includes(String(i.type)))
        if (target && queueEnabled()) {
          const drafts = (await articlesRepo.list(String(projectId), 200)).filter((a) => a.status === 'draft')
          for (const d of drafts) {
            const planItem = plan.find((p) => p.id === (d.planItemId ?? d.id))
            if (!planItem) continue
            const ageOk = policy === 'immediate' ? false : (policy === 'buffered' && planItem.plannedDate ? daysBetween(new Date(planItem.plannedDate), new Date()) >= Math.max(0, bufferDays) : false)
            const hasBody = typeof d.bodyHtml === 'string' && d.bodyHtml.replace(/<[^>]+>/g, ' ').trim().length > 500
            if (ageOk && hasBody) {
              await publishJob({ type: 'publish', payload: { articleId: d.id, integrationId: target.id } })
              publishedArticles++
            }
          }
        }
        // No usage persistence (org_usage removed)
        return json({ result: { generatedDrafts, publishedArticles } })
      })
    }
  }
})

function daysBetween(a: Date, b: Date) {
  const ms = Math.abs(b.getTime() - a.getTime())
  return Math.floor(ms / (24 * 60 * 60 * 1000))
}
