// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, requireSession, requireWebsiteAccess } from '@app/api-utils'
import { getDb, hasDatabase } from '@common/infra/db'
import { websiteKeywords } from '@entities/keyword/db/schema.website_keywords'
import { eq } from 'drizzle-orm'

export const Route = createFileRoute('/api/websites/$websiteId/keywords')({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        await requireSession(request)
        await requireWebsiteAccess(request, params.websiteId)
        if (!hasDatabase()) return httpError(500, 'Database not available')
        const db = getDb()
        const url = new URL(request.url)
        const includeParam = url.searchParams.get('include')
        const rows = await db
          .select()
          .from(websiteKeywords)
          .where(eq(websiteKeywords.websiteId, params.websiteId))
          .limit(300)
        // Shape for UI compatibility: provide metricsJson
        const itemsAll = rows.map((r: any) => ({
          id: r.id,
          websiteId: r.websiteId,
          phrase: r.phrase,
          include: Boolean(r.include),
          starred: Boolean(r.starred),
          metricsJson: {
            searchVolume: r.searchVolume ?? null,
            difficulty: r.difficulty ?? null,
            cpc: r.cpc ? Number(r.cpc) : null,
            competition: r.competition ? Number(r.competition) : null,
            asOf: r.metricsAsOf ?? null
          }
        }))
        const filtered = includeParam == null ? itemsAll : itemsAll.filter((i) => Boolean(i.include) === (includeParam === 'true'))
        return json({ items: filtered })
      }
    }
  }
})
