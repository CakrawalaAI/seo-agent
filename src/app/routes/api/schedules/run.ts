// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, safeHandler } from '../utils'
import { planRepo } from '@entities/plan/repository'
import { articlesRepo } from '@entities/article/repository'
import { integrationsRepo } from '@entities/integration/repository'
import { env } from '@common/infra/env'
import { publishViaWebhook } from '@common/publishers/webhook'

export const Route = createFileRoute('/api/schedules/run')({
  server: {
    handlers: {
      POST: safeHandler(async ({ request }) => {
        const body = await request.json().catch(() => ({}))
        const projectId = body?.projectId
        if (!projectId) return httpError(400, 'Missing projectId')
        const today = new Date().toISOString().slice(0, 10)
        const plan = planRepo.list(String(projectId), 365)
        const existing = new Map(articlesRepo.list(String(projectId), 999).map((a) => [a.planItemId ?? '', a]))
        let generatedDrafts = 0
        let publishedArticles = 0
        for (const item of plan) {
          if (item.plannedDate === today && !existing.has(item.id)) {
            articlesRepo.createDraft({ projectId: String(projectId), planItemId: item.id, title: item.title })
            generatedDrafts++
            // auto-publish policy
            const integrations = integrationsRepo.list(String(projectId))
            const webhook = integrations.find((i) => i.type === 'webhook' && i.status === 'connected')
            const allowed = env.publicationAllowed.includes('webhook') && webhook
            const policy = env.autopublishPolicy
            const bufferOk =
              policy === 'immediate' ||
              (policy === 'buffered' && item.createdAt
                ? daysBetween(new Date(item.createdAt), new Date()) >= Math.max(0, env.bufferDays)
                : false)
            if (allowed && bufferOk) {
              const draft = articlesRepo.list(String(projectId), 10).find((a) => a.planItemId === item.id)
              if (draft) {
                const result = await publishViaWebhook({
                  article: draft,
                  targetUrl: String(webhook!.configJson?.targetUrl ?? ''),
                  secret: (webhook!.configJson as any)?.secret ?? null
                })
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
