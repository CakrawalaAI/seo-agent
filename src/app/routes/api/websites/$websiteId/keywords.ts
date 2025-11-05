// @ts-nocheck
import { createFileRoute } from '@tanstack/react-router'
import { json, httpError, requireSession, requireWebsiteAccess } from '@app/api-utils'
import { getDb, hasDatabase } from '@common/infra/db'
import { keywords } from '@entities/keyword/db/schema.keywords'
import { and, asc, desc, eq, ilike, inArray, sql } from 'drizzle-orm'
import { keywordsRepo, shouldActivateKeyword } from '@entities/keyword/repository'
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
        const activeParam = url.searchParams.get('active')
        const searchParamRaw = String(url.searchParams.get('search') ?? '').trim()
        const limitParam = Number(url.searchParams.get('limit'))
        const pageParam = Number(url.searchParams.get('page'))
        const limit = Number.isFinite(limitParam) ? Math.max(1, Math.min(limitParam, 1000)) : 300
        const requestedPage = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1

        const baseConditions = [eq(keywords.websiteId, params.websiteId)]
        if (searchParamRaw) {
          baseConditions.push(ilike(keywords.phrase, `%${escapeIlike(searchParamRaw)}%`))
        }
        const totalWhere = baseConditions.length === 1 ? baseConditions[0]! : and(...baseConditions)

        const [totalRows, activeRows] = await Promise.all([
          db
            .select({ value: sql<number>`count(*)` })
            .from(keywords)
            .where(totalWhere),
          db
            .select({ value: sql<number>`count(*)` })
            .from(keywords)
            .where(and(...[...baseConditions, eq(keywords.active, true)]))
        ])
        let total = Number(totalRows?.[0]?.value ?? 0)
        let active = Number(activeRows?.[0]?.value ?? 0)
        const pageCount = Math.max(1, Math.ceil(Math.max(total, 0) / limit))
        const safePage = Math.min(Math.max(requestedPage, 1), pageCount)
        const offset = Math.max(0, (safePage - 1) * limit)

        const rowConditions = [...baseConditions]
        if (activeParam != null) {
          rowConditions.push(eq(keywords.active, activeParam === 'true'))
        }
        const rowsWhere = rowConditions.length === 1 ? rowConditions[0]! : and(...rowConditions)

        const rows = await db
          .select()
          .from(keywords)
          .where(rowsWhere)
          .orderBy(
            desc(keywords.active),
            desc(sql`CASE WHEN ${keywords.difficulty} IS NULL THEN 0 ELSE 1 END`),
            desc(sql`COALESCE(${keywords.searchVolume}, 0)`),
            asc(sql`COALESCE(${keywords.difficulty}, 100)`),
            desc(keywords.createdAt)
          )
          .limit(limit)
          .offset(offset)

        let itemsAll = rows.map(shapeKeywordRow)

        if (!searchParamRaw && activeParam == null && safePage === 1) {
          const allRows = await db
            .select()
            .from(keywords)
            .where(eq(keywords.websiteId, params.websiteId))
          const shapedAll = allRows.map(shapeKeywordRow)
          const autoSet = keywordsRepo.selectTopForAutoActive(shapedAll)
          const desiredActiveIds = new Set<string>()
          for (const item of shapedAll) {
            if (autoSet.has(normalizeKeyword(item.phrase))) {
              desiredActiveIds.add(item.id)
            }
          }
          const toActivate = shapedAll.filter((item) => desiredActiveIds.has(item.id) && !item.active).map((item) => item.id)
          const toDeactivate = shapedAll.filter((item) => !desiredActiveIds.has(item.id) && item.active).map((item) => item.id)
          if (toActivate.length) {
            await db.update(keywords).set({ active: true }).where(and(eq(keywords.websiteId, params.websiteId), inArray(keywords.id, toActivate)))
          }
          if (toDeactivate.length) {
            await db.update(keywords).set({ active: false }).where(and(eq(keywords.websiteId, params.websiteId), inArray(keywords.id, toDeactivate)))
          }
          if (toActivate.length || toDeactivate.length) {
            itemsAll = rows.map((row) => {
              const shaped = shapeKeywordRow(row)
              const shouldInclude = desiredActiveIds.has(shaped.id)
              return shouldInclude === shaped.active ? shaped : { ...shaped, active: shouldInclude }
            })
          }
          total = shapedAll.length
          active = desiredActiveIds.size
        }

        return json({ items: itemsAll, total, active, page: safePage, pageCount })
      },
      POST: async ({ params, request }) => {
        await requireSession(request)
        await requireWebsiteAccess(request, params.websiteId)
        if (!hasDatabase()) return httpError(500, 'Database not available')
        const body = await request.json().catch(() => ({}))
        const phrase = normalizeKeyword(String(body?.phrase || '').trim())
        if (!phrase) return httpError(400, 'Keyword phrase is required')
        const website = await websitesRepo.get(params.websiteId)
        if (!website) return httpError(404, 'Website not found')
        const locale = String(body?.locale || website.defaultLocale || 'en-US')
        const languageCode = String(body?.languageCode || languageCodeFromLocale(locale))
        const locationCode = Number.isFinite(Number(body?.locationCode)) ? Number(body.locationCode) : locationCodeFromLocale(locale)
        const useMock = String(process.env.MOCK_KEYWORD_GENERATOR || '').trim().toLowerCase() === 'true'
        const previewOnly = Boolean(body?.preview)
        const skipLookup = Boolean(body?.skipLookup)

        let overview: Awaited<ReturnType<typeof keywordOverview>> | Record<string, unknown> | null = null
        if (skipLookup && isPlainObject(body?.overview)) {
          overview = body.overview as Record<string, unknown>
        } else if (useMock) {
          overview = buildMockOverview(phrase)
        } else {
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
        const providerNameDefault = useMock ? 'mock.manual_keyword' : 'dataforseo.labs.keyword_overview'
        const providerName = typeof body?.provider === 'string' && body.provider ? String(body.provider) : providerNameDefault
        const metricsAsOf = typeof body?.metricsAsOf === 'string' && body.metricsAsOf
          ? body.metricsAsOf
          : typeof (info as any)?.last_updated_time === 'string'
            ? String((info as any).last_updated_time)
            : new Date().toISOString()
        const impressions = isPlainObject((overview as any)?.impressions_info)
          ? ((overview as any).impressions_info as Record<string, unknown>)
          : null
        const raw = cloneJson(overview)
        const activeOverride = parseBoolean(body?.active)
        const active = activeOverride == null
          ? shouldActivateKeyword({ active: activeOverride, metricsJson: { searchVolume, difficulty } })
          : activeOverride

        if (previewOnly) {
          if (overview == null && searchVolume == null && difficulty == null && cpc == null && competition == null) {
            log.debug('[api.keywords.manual] preview_empty', {
              websiteId: params.websiteId,
              phrase,
              languageCode,
              locationCode,
              provider: providerName,
              useMock,
              skipLookup,
              rawOverview: summarizeForLog(overview)
            })
            log.debug('[api.keywords.manual] preview_unavailable', {
              websiteId: params.websiteId,
              phrase,
              languageCode,
              locationCode,
              provider: providerName,
              useMock,
              skipLookup,
              hasOverview: Boolean(overview),
              manualVolume,
              manualDifficulty,
              manualCpc,
              manualCompetition,
              summary: summarizeForLog(overview)
            })
            return httpError(502, 'Keyword metrics unavailable')
          }
          return json({
            preview: {
              phrase,
              searchVolume,
              difficulty,
              cpc,
              competition,
              impressions,
              vol12m: monthly,
              provider: providerName,
              metricsAsOf,
              overview: raw
            }
          })
        }

        const result = await keywordsRepo.upsert({
          websiteId: params.websiteId,
          phrase,
          languageCode,
          languageName: languageNameFromCode(languageCode),
          locationCode,
          locationName: locationNameFromCode(locationCode),
          active,
          searchVolume,
          cpc,
          competition,
          difficulty,
          vol12m: monthly,
          impressions,
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
    active: Boolean(row.active),
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

function escapeIlike(value: string): string {
  return value.replace(/[%_]/g, (match) => `\\${match}`)
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
}

function parseBoolean(value: unknown): boolean | null {
  if (value === undefined || value === null) return null
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') {
    const norm = value.trim().toLowerCase()
    if (!norm) return null
    if (['true', '1', 'yes', 'y'].includes(norm)) return true
    if (['false', '0', 'no', 'n'].includes(norm)) return false
  }
  return null
}

function cloneJson<T>(value: T): T | null {
  if (value == null) return null
  try {
    return JSON.parse(JSON.stringify(value)) as T
  } catch {
    return null
  }
}

function summarizeForLog(value: unknown): string | null {
  if (value == null) return null
  try {
    const json = JSON.stringify(value)
    return json.length > 480 ? `${json.slice(0, 480)}…` : json
  } catch {
    return '[unserializable]'
  }
}

function buildMockOverview(keyword: string): Record<string, unknown> {
  const norm = normalizeKeyword(keyword) || keyword
  const seed = hashString(norm)
  const baseVolume = 600 + (seed % 6400)
  const difficulty = Math.max(18, Math.min(80, 20 + (seed % 65)))
  const cpc = Number((1.1 + (seed % 450) / 100).toFixed(2))
  const competition = Number((0.25 + ((seed >> 5) % 55) / 100).toFixed(2))
  const now = new Date()
  const monthly_searches = Array.from({ length: 12 }).map((_, index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - index, 1))
    const variance = 0.7 + (((seed >> (index % 12)) % 55) / 100)
    const searchVolume = Math.max(25, Math.round((baseVolume / 12) * variance))
    return {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      search_volume: searchVolume
    }
  })
  const timestamp = new Date().toISOString()
  return {
    keyword,
    keyword_info: {
      keyword,
      search_volume: baseVolume,
      cpc,
      competition,
      keyword_difficulty: difficulty,
      last_updated_time: timestamp,
      monthly_searches
    },
    keyword_properties: {
      keyword_difficulty: difficulty
    },
    impressions_info: {
      last_updated_time: timestamp,
      ad_position_min: 1,
      ad_position_max: 3,
      ad_position_prominence: Number((0.62 + ((seed >> 7) % 30) / 100).toFixed(2)),
      ad_impressions_share: Number((0.3 + ((seed >> 9) % 35) / 100).toFixed(2))
    }
  }
}

function hashString(input: string): number {
  let hash = 2166136261
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}
