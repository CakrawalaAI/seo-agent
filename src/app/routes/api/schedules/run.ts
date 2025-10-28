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
import { publishViaWebhook } from '@common/publishers/webhook'
import { publishViaWebflow } from '@common/publishers/webflow'
import { queueEnabled, publishJob } from '@common/infra/queue'
import { session } from '@common/infra/session'

export const Route = createFileRoute('/api/schedules/run')({
  server: {
    handlers: {
      POST: safeHandler(async ({ request }) => {
        requireSession(request)
        const body = await request.json().catch(() => ({}))
        const projectId = body?.projectId
        if (!projectId) return httpError(400, 'Missing projectId')
        await requireProjectAccess(request, String(projectId))
        const today = new Date().toISOString().slice(0, 10)
        const sess = session.read(request)
        const dailyCap = Math.max(0, Number(sess?.entitlements?.dailyArticles ?? 0)) || Infinity
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
            if (generatedDrafts >= dailyCap) continue
            // Inline draft generation to keep UI responsive
            articlesRepo.createDraft({ projectId: String(projectId), planItemId: item.id, title: item.title })
            generatedDrafts++
            // Also enqueue generation job for providers if a queue is available
            if (queueEnabled()) {
              await publishJob({ type: 'generate', payload: { projectId: String(projectId), planItemId: item.id } })
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
        return json({ result: { generatedDrafts, publishedArticles } })
      })
    }
  }
})

function daysBetween(a: Date, b: Date) {
  const ms = Math.abs(b.getTime() - a.getTime())
  return Math.floor(ms / (24 * 60 * 60 * 1000))
}
