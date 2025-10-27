// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json } from '../../utils'
import { planRepo } from '@entities/plan/repository'

export const Route = createFileRoute('/api/projects/$projectId/plan')({
  server: {
    handlers: {
      GET: ({ params, request }) => {
        const url = new URL(request.url)
        const limit = Number(url.searchParams.get('limit') || '90')
        const items = planRepo.list(params.projectId, Number.isFinite(limit) ? limit : 90)
        return json({ items })
      }
    }
  }
})

