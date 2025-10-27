// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, safeHandler } from '../utils'
import { planRepo } from '@entities/plan/repository'
import { articlesRepo } from '@entities/article/repository'

export const Route = createFileRoute('/api/articles/generate')({
  server: {
    handlers: {
      POST: safeHandler(async ({ request }) => {
        const body = await request.json().catch(() => ({}))
        const planItemId = body?.planItemId
        if (!planItemId) return httpError(400, 'Missing planItemId')
        const found = planRepo.findById(String(planItemId))
        if (!found) return httpError(404, 'Plan item not found')
        const draft = articlesRepo.createDraft({ projectId: found.projectId, planItemId: found.item.id, title: found.item.title })
        return json({ articleId: draft.id, status: draft.status })
      })
    }
  }
})

