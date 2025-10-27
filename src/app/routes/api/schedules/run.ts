// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, safeHandler } from '../utils'
import { planRepo } from '@entities/plan/repository'
import { articlesRepo } from '@entities/article/repository'

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
        for (const item of plan) {
          if (item.plannedDate === today && !existing.has(item.id)) {
            articlesRepo.createDraft({ projectId: String(projectId), planItemId: item.id, title: item.title })
            generatedDrafts++
          }
        }
        return json({ result: { generatedDrafts, publishedArticles: 0 } })
      })
    }
  }
})

