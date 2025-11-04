// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, requireSession, requireWebsiteAccess } from '@app/api-utils'
import { getDb, hasDatabase } from '@common/infra/db'
import { keywords } from '@entities/keyword/db/schema.keywords'
import { eq } from 'drizzle-orm'
import { keywordsRepo } from '@entities/keyword/repository'
import { websitesRepo } from '@entities/website/repository'
import {
  languageCodeFromLocale,
  languageNameFromCode,
  locationCodeFromLocale,
  locationNameFromCode
} from '@common/providers/impl/dataforseo/geo'

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
          .from(keywords)
          .where(eq(keywords.websiteId, params.websiteId))
          .limit(300)
        const itemsAll = rows.map(shapeKeywordRow)
        const filtered = includeParam == null ? itemsAll : itemsAll.filter((i) => Boolean(i.include) === (includeParam === 'true'))
        return json({ items: filtered })
      },
      POST: async ({ params, request }) => {
        await requireSession(request)
        await requireWebsiteAccess(request, params.websiteId)
        if (!hasDatabase()) return httpError(500, 'Database not available')
        const body = await request.json().catch(() => ({}))
        const phrase = String(body?.phrase || '').trim()
        if (!phrase) return httpError(400, 'Keyword phrase is required')
        const website = await websitesRepo.get(params.websiteId)
        if (!website) return httpError(404, 'Website not found')
        const locale = String(body?.locale || website.defaultLocale || 'en-US')
        const languageCode = String(body?.languageCode || languageCodeFromLocale(locale))
        const locationCode = Number.isFinite(Number(body?.locationCode)) ? Number(body.locationCode) : locationCodeFromLocale(locale)
        const result = await keywordsRepo.upsert({
          websiteId: params.websiteId,
          phrase,
          phraseNorm: normalizeKeyword(phrase),
          languageCode,
          languageName: languageNameFromCode(languageCode),
          locationCode,
          locationName: locationNameFromCode(locationCode),
          include: Boolean(body?.include),
          searchVolume: toNumberOrNull(body?.searchVolume),
          cpc: toNumberOrNull(body?.cpc),
          competition: toNumberOrNull(body?.competition),
          difficulty: toNumberOrNull(body?.difficulty),
          metricsAsOf: new Date().toISOString()
        })
        if (!result) return httpError(500, 'Unable to save keyword')
        return json({ item: shapeKeywordRow(result) }, { status: 201 })
      }
    }
  }
})

function shapeKeywordRow(row: any) {
  return {
    id: row.id,
    websiteId: row.websiteId,
    phrase: row.phrase,
    include: Boolean(row.include),
    starred: Boolean(row.starred),
    metricsJson: {
      searchVolume: row.searchVolume == null ? null : Number(row.searchVolume),
      difficulty: row.difficulty == null ? null : Number(row.difficulty),
      cpc: row.cpc == null ? null : Number(row.cpc),
      competition: row.competition == null ? null : Number(row.competition),
      asOf: row.metricsAsOf ?? null
    }
  }
}

function normalizeKeyword(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function toNumberOrNull(value: unknown): number | null {
  if (value == null || value === '') return null
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}
