// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, requireSession, requireProjectAccess } from '@app/api-utils'
import { keywordsRepo } from '@entities/keyword/repository'
import { hasDatabase, getDb } from '@common/infra/db'
import { keywords } from '@entities/keyword/db/schema'
import { eq } from 'drizzle-orm'

export const Route = createFileRoute('/api/projects/$projectId/keywords')({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        await requireSession(request)
        await requireProjectAccess(request, params.projectId)
        const url = new URL(request.url)
        const status = url.searchParams.get('status') || undefined
        const limit = Number(url.searchParams.get('limit') || '100')
        if (hasDatabase()) {
          try {
            const db = getDb()
            // @ts-ignore
            const q = (db.select().from(keywords).where(eq(keywords.projectId, params.projectId)) as any)
            const rows = await (status && status !== 'all'
              ? q.where((keywords as any).status.eq(status)).limit(Number.isFinite(limit) ? limit : 100)
              : q.limit(Number.isFinite(limit) ? limit : 100))
            return json({ items: rows })
          } catch {}
        }
        const items = await keywordsRepo.list(params.projectId, {
          status: status ?? 'all',
          limit: Number.isFinite(limit) ? limit : 100
        })
        return json({ items })
      }
    }
  }
})
