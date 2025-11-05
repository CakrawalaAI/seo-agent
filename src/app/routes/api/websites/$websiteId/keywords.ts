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
import { keywordOverview } from '@common/providers/impl/dataforseo/keyword-overview'
import { log } from '@src/common/logger'

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
        const useMock = String(process.env.MOCK_KEYWORD_GENERATOR || '').trim().toLowerCase() === 'true'
        let overview: Awaited<ReturnType<typeof keywordOverview>> = null
        if (!useMock) {
          try {
            overview = await keywordOverview({ keyword: phrase, languageCode, locationCode })
          } catch (error) {
            log.warn('[api.keywords.manual] keyword overview failed', {
              websiteId: params.websiteId,
              phrase,
              error: (error as Error)?.message || String(error)
            })
          }
        }

        const info = overview?.keyword_info || {}
        const props = overview?.keyword_properties || {}
        const manualVolume = toNumberOrNull(body?.searchVolume)
        const manualDifficulty = toNumberOrNull(body?.difficulty)
        const manualCpc = toNumberOrNull(body?.cpc)
        const manualCompetition = toNumberOrNull(body?.competition)
        const searchVolume = pickNumber(info?.search_volume, manualVolume)
        const difficulty = pickNumber(props?.keyword_difficulty, manualDifficulty)
        const cpc = pickNumber(info?.cpc, manualCpc)
        const competition = pickNumber(info?.competition, manualCompetition)
        const monthly = Array.isArray((info as any)?.monthly_searches)
          ? (info as any).monthly_searches
              .map((m: any) => ({ month: `${m?.year ?? ''}-${String(m?.month ?? 1).padStart(2, '0')}`, searchVolume: Number(m?.search_volume ?? 0) }))
              .filter((entry: any) => entry.month && Number.isFinite(entry.searchVolume))
          : null
        const providerName = useMock ? 'mock.manual_keyword' : 'dataforseo.labs.keyword_overview'
        const raw = overview || null
        const metricsAsOf = new Date().toISOString()

        const result = await keywordsRepo.upsert({
          websiteId: params.websiteId,
          phrase,
          phraseNorm: normalizeKeyword(phrase),
          languageCode,
          languageName: languageNameFromCode(languageCode),
          locationCode,
          locationName: locationNameFromCode(locationCode),
          include: Boolean(body?.include),
          searchVolume,
          cpc,
          competition,
          difficulty,
          vol12m: monthly,
          impressions: overview?.impressions_info || null,
          raw,
          provider: providerName,
          metricsAsOf
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

function pickNumber(primary: unknown, fallback: number | null | undefined): number | null {
  if (primary !== null && primary !== undefined) {
    const num = Number(primary)
    if (Number.isFinite(num)) return num
  }
  return fallback ?? null
}
