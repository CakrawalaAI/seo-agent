// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, safeHandler } from './utils'
import { planRepo } from '@entities/plan/repository'

export const Route = createFileRoute('/api/plan-items')({
  server: {
    handlers: {
      GET: safeHandler(({ request }) => {
        const url = new URL(request.url)
        const projectId = url.searchParams.get('projectId')
        const limit = Number(url.searchParams.get('limit') || '90')
        if (!projectId) return httpError(400, 'Missing projectId')
        const items = planRepo.list(projectId, Number.isFinite(limit) ? limit : 90)
        return json({ items })
      }),
      POST: safeHandler(async ({ request }) => {
        const body = await request.json().catch(() => ({}))
        const projectId = body?.projectId
        const days = Number(body?.days ?? 30)
        if (!projectId || !Number.isFinite(days) || days <= 0) return httpError(400, 'Invalid input')
        const { jobId } = planRepo.createPlan(String(projectId), days)
        return json({ jobId }, { status: 202 })
      })
    }
  }
})

