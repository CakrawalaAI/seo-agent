// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, safeHandler, requireSession, requireProjectAccess } from '@app/api-utils'
import { planRepo } from '@entities/plan/repository'
import { articlesRepo } from '@entities/article/repository'
import { integrationsRepo } from '@entities/integration/repository'
import { env } from '@common/infra/env'
import { hasDatabase, getDb } from '@common/infra/db'
import { projects } from '@entities/project/db/schema'
import { orgs, orgUsage } from '@entities/org/db/schema'
import { eq } from 'drizzle-orm'
import { publishViaWebhook } from '@common/publishers/webhook'
import { publishViaWebflow } from '@common/publishers/webflow'
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
        // Pull monthly credits and usage from DB (fallback: unlimited)
        let remainingCredits = Infinity
        let activeOrgId: string | null = null
        try {
          const sess = await requireSession(request)
          activeOrgId = sess.activeOrg?.id ?? null
          if (activeOrgId && hasDatabase()) {
            const db = getDb()
            // @ts-ignore
            const orgRows = await (db.select().from(orgs).where(eq(orgs.id, activeOrgId)).limit(1) as any)
            const ent = orgRows?.[0]?.entitlementsJson
            const total = Number(ent?.monthlyPostCredits || 0)
            if (Number.isFinite(total) && total > 0) {
              // @ts-ignore
              const urows = await (db.select().from(orgUsage).where((orgUsage as any).orgId.eq(activeOrgId)).limit(1) as any)
              const used = Number(urows?.[0]?.postsUsed || 0)
              remainingCredits = Math.max(0, total - used)
            }
          }
        } catch {}
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
        const plan = planRepo.list(String(projectId), 365)
        const existing = new Map(articlesRepo.list(String(projectId), 999).map((a) => [a.planItemId ?? '', a]))
        let generatedDrafts = 0
        let publishedArticles = 0
        for (const item of plan) {
          if (item.plannedDate === today && !existing.has(item.id)) {
            if (generatedDrafts >= remainingCredits) continue
            // Inline draft generation to keep UI responsive
            articlesRepo.createDraft({ projectId: String(projectId), planItemId: item.id, title: item.title })
            generatedDrafts++
            // Also enqueue generation job for providers if a queue is available
            if (queueEnabled()) {
              const jobId = await publishJob({ type: 'generate', payload: { projectId: String(projectId), planItemId: item.id } })
              console.info('[api/schedules/run] queued generate', { projectId: String(projectId), planItemId: item.id, jobId })
            } else {
              console.warn('[api/schedules/run] queue disabled; skipped provider generate job', { projectId: String(projectId), planItemId: item.id })
            }
            // auto-publish policy
            const integrations = integrationsRepo.list(String(projectId))
            const target = integrations.find((i) => i.status === 'connected' && env.publicationAllowed.includes(String(i.type)))
            const allowed = Boolean(target)
            const bufferOk =
              policy === 'immediate' ||
              (policy === 'buffered' && item.createdAt
                ? daysBetween(new Date(item.createdAt), new Date()) >= Math.max(0, bufferDays)
                : false)
            if (allowed && bufferOk) {
              const draft = articlesRepo.list(String(projectId), 10).find((a) => a.planItemId === item.id)
              if (draft) {
                let result: { externalId?: string; url?: string } | null = null
                if (target!.type === 'webhook') {
                  result = await publishViaWebhook({
                    article: draft,
                    targetUrl: String(target!.configJson?.targetUrl ?? ''),
                    secret: (target!.configJson as any)?.secret ?? null
                  })
                } else if (target!.type === 'webflow') {
                  result = await publishViaWebflow({
                    article: draft,
                    siteId: String((target!.configJson as any)?.siteId ?? ''),
                    collectionId: String((target!.configJson as any)?.collectionId ?? ''),
                    draft: Boolean((target!.configJson as any)?.draft)
                  })
                }
                articlesRepo.update(draft.id, {
                  status: 'published',
                  cmsExternalId: result?.externalId ?? null,
                  url: result?.url ?? null,
                  publicationDate: new Date().toISOString()
                })
                publishedArticles++
              }
            }
          }
        }
        // Persist usage increment if credits were limited
        if (hasDatabase() && activeOrgId && Number.isFinite(remainingCredits)) {
          try {
            const db = getDb()
            // @ts-ignore
            const urows = await (db.select().from(orgUsage).where((orgUsage as any).orgId.eq(activeOrgId)).limit(1) as any)
            const used = Number(urows?.[0]?.postsUsed || 0)
            await db
              .update(orgUsage)
              .set({ postsUsed: used + generatedDrafts, updatedAt: new Date() as any })
              // @ts-ignore
              .where((orgUsage as any).orgId.eq(activeOrgId))
            const total = Number.isFinite(remainingCredits) ? used + generatedDrafts + (remainingCredits as number) : 0
            const newUsed = used + generatedDrafts
            if (total > 0 && newUsed / total >= 0.9) {
              console.warn('[billing] usage high', { orgId: activeOrgId, used: newUsed, total })
            }
          } catch {}
        }
        return json({ result: { generatedDrafts, publishedArticles } })
      })
    }
  }
})

function daysBetween(a: Date, b: Date) {
  const ms = Math.abs(b.getTime() - a.getTime())
  return Math.floor(ms / (24 * 60 * 60 * 1000))
}
