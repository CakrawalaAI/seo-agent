// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, requireSession, requireProjectAccess } from '@app/api-utils'
import { keywordsRepo } from '@entities/keyword/repository'
import type { KeywordScope } from '@entities/keyword/domain/keyword'

export const Route = createFileRoute('/api/projects/$projectId/keywords')({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        await requireSession(request)
        await requireProjectAccess(request, params.projectId)
        const url = new URL(request.url)
        const status = url.searchParams.get('status') || undefined
        const limit = Number(url.searchParams.get('limit') || '100')
        const scopeRaw = url.searchParams.get('scope')
        const scopeParam: KeywordScope | 'all' = scopeRaw === 'include' || scopeRaw === 'exclude' || scopeRaw === 'auto' ? scopeRaw : 'all'
        const items = await keywordsRepo.list(params.projectId, {
          status: status ?? 'all',
          scope: scopeParam,
          limit: Number.isFinite(limit) ? limit : 100
        })
        return json({ items })
      }
    }
  }
})
