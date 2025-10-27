// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json } from '../../utils'
import { keywordsRepo } from '@entities/keyword/repository'

export const Route = createFileRoute('/api/projects/$projectId/keywords')({
  server: {
    handlers: {
      GET: ({ params, request }) => {
        const url = new URL(request.url)
        const status = url.searchParams.get('status') || undefined
        const limit = Number(url.searchParams.get('limit') || '100')
        const items = keywordsRepo.list(params.projectId, {
          status: status ?? 'all',
          limit: Number.isFinite(limit) ? limit : 100
        })
        return json({ items })
      }
    }
  }
})

