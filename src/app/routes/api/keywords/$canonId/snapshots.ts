// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, safeHandler, requireSession } from '@app/api-utils'
import { hasDatabase, getDb } from '@common/infra/db'
import { keywordMetricsSnapshot } from '@entities/keyword/db/schema.snapshots'
import { and, eq, gte, lte } from 'drizzle-orm'

export const Route = createFileRoute('/api/keywords/$canonId/snapshots')({
  server: {
    handlers: {
      GET: safeHandler(async ({ params, request }) => {
        await requireSession(request)
        if (!hasDatabase()) return json({ items: [] })
        const db = getDb()
        const url = new URL(request.url)
        const from = url.searchParams.get('from') || '0000-01'
        const to = url.searchParams.get('to') || '9999-12'
        try {
          // @ts-ignore
          const rows = await db
            .select()
            .from(keywordMetricsSnapshot)
            .where(
              and(
                eq(keywordMetricsSnapshot.canonId, params.canonId),
                gte(keywordMetricsSnapshot.asOfMonth as any, from),
                lte(keywordMetricsSnapshot.asOfMonth as any, to)
              )
            )
            .orderBy(keywordMetricsSnapshot.asOfMonth as any)
          return json({ items: rows })
        } catch {
          return json({ items: [] })
        }
      })
    }
  }
})

