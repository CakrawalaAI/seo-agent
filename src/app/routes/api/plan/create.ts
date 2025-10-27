// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, safeHandler } from '../utils'
import { planRepo } from '@entities/plan/repository'

export const Route = createFileRoute('/api/plan/create')({
  server: {
    handlers: {
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

