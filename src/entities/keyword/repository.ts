import { hasDatabase, getDb } from '@common/infra/db'
import { env } from '@common/infra/env'
import { keywords } from './db/schema.keywords'
import { and, eq, sql } from 'drizzle-orm'

export const keywordsRepo = {
  selectTopForAutoActive(keywords: Array<{ active?: boolean | null; metricsJson?: any; searchVolume?: number | null; difficulty?: number | null; phrase: string }>, limit = env.keywordAutoIncludeLimit) {
    if (!Array.isArray(keywords) || keywords.length === 0) return new Set<string>()
    const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ')
    const eligible = keywords
      .filter((keyword) => {
        const metrics = keyword.metricsJson || {}
        const volume = metrics.searchVolume ?? keyword.searchVolume
        const difficulty = metrics.difficulty ?? keyword.difficulty
        if (volume == null || difficulty == null) return false
        if (!Number.isFinite(Number(volume)) || Number(volume) <= 0) return false
        if (!Number.isFinite(Number(difficulty)) || Number(difficulty) <= 0) return false
        return Number(difficulty) < 70
      })
      .sort((a, b) => {
        const metricsA = a.metricsJson || {}
        const metricsB = b.metricsJson || {}
        const volA = Number(metricsA.searchVolume ?? a.searchVolume ?? 0)
        const volB = Number(metricsB.searchVolume ?? b.searchVolume ?? 0)
        if (volA === volB) {
          const diffA = Number(metricsA.difficulty ?? a.difficulty ?? 0)
          const diffB = Number(metricsB.difficulty ?? b.difficulty ?? 0)
          return diffA - diffB
        }
        return volB - volA
      })

    const selection = new Set<string>()
    for (const keyword of eligible.slice(0, Math.max(0, limit))) {
      selection.add(normalize(keyword.phrase))
    }
    return selection
  },
  async upsert(input: {
    websiteId: string
    phrase: string
    languageCode: string
    languageName: string
    locationCode: number
    locationName: string
    provider?: string
    active?: boolean
    searchVolume?: number | null
    cpc?: number | null
    competition?: number | null
    difficulty?: number | null
    vol12m?: Array<{ month: string; searchVolume: number }> | null
    impressions?: Record<string, unknown> | null
    raw?: Record<string, unknown> | null
    metricsAsOf?: string | Date | null
  }) {
    if (!hasDatabase()) return null
    const db = getDb()
    const id = genId('kw')
    const now = new Date() as any
    const provider = input.provider || 'dataforseo.labs.keyword_ideas'
    // Upsert via delete+insert or onConflictDoUpdate if available
    try {
      // @ts-ignore drizzle may support onConflictDoUpdate
      await db
        .insert(keywords)
        .values({
          id,
          websiteId: input.websiteId,
          phrase: input.phrase,
          languageCode: input.languageCode,
          languageName: input.languageName,
          locationCode: input.locationCode,
          locationName: input.locationName,
          provider,
          active: Boolean(input.active) as any,
          searchVolume: input.searchVolume == null ? null : Math.trunc(Number(input.searchVolume)),
          cpc: input.cpc == null ? null : String(input.cpc),
          competition: input.competition == null ? null : String(input.competition),
          difficulty: input.difficulty == null ? null : Math.trunc(Number(input.difficulty)),
          vol12mJson: input.vol12m ?? null,
          impressionsJson: input.impressions ?? null,
          rawJson: input.raw ?? null,
          metricsAsOf: input.metricsAsOf ? new Date(input.metricsAsOf as any) : (now as any),
          createdAt: now,
          updatedAt: now
        } as any)
        .onConflictDoUpdate?.({
          target: [keywords.websiteId, keywords.phrase, keywords.languageCode, keywords.locationCode],
          set: {
            provider,
            // do not touch active on updates; preserve user choice
            searchVolume: input.searchVolume == null ? null : Math.trunc(Number(input.searchVolume)),
            cpc: input.cpc == null ? null : String(input.cpc),
            competition: input.competition == null ? null : String(input.competition),
            difficulty: input.difficulty == null ? null : Math.trunc(Number(input.difficulty)),
            vol12mJson: input.vol12m ?? null,
            impressionsJson: input.impressions ?? null,
            rawJson: input.raw ?? null,
            metricsAsOf: input.metricsAsOf ? new Date(input.metricsAsOf as any) : (now as any),
            updatedAt: now
          }
        })
      return await this.getByKey(input.websiteId, input.phrase, input.languageCode, input.locationCode)
    } catch {
      // Fallback: delete existing then insert
      await db
        .delete(keywords)
        .where(
          and(
            eq(keywords.websiteId, input.websiteId),
            eq(keywords.phrase, input.phrase),
            eq(keywords.languageCode, input.languageCode),
            eq(keywords.locationCode, input.locationCode as any)
          )
        )
      await db.insert(keywords).values({
        id,
        websiteId: input.websiteId,
        phrase: input.phrase,
        languageCode: input.languageCode,
        languageName: input.languageName,
        locationCode: input.locationCode,
        locationName: input.locationName,
        provider,
        active: Boolean(input.active) as any,
        searchVolume: input.searchVolume == null ? null : Math.trunc(Number(input.searchVolume)),
        cpc: input.cpc == null ? null : String(input.cpc),
        competition: input.competition == null ? null : String(input.competition),
        difficulty: input.difficulty == null ? null : Math.trunc(Number(input.difficulty)),
        vol12mJson: input.vol12m ?? null,
        impressionsJson: input.impressions ?? null,
        rawJson: input.raw ?? null,
        metricsAsOf: input.metricsAsOf ? new Date(input.metricsAsOf as any) : (new Date() as any),
        createdAt: now,
        updatedAt: now
      } as any)
      return await this.getByKey(input.websiteId, input.phrase, input.languageCode, input.locationCode)
    }
  },

  async getByKey(websiteId: string, phrase: string, languageCode: string, locationCode: number) {
    if (!hasDatabase()) return null
    const db = getDb()
    const rows = await db
      .select()
      .from(keywords)
      .where(
        and(
          eq(keywords.websiteId, websiteId),
          eq(keywords.phrase, phrase),
          eq(keywords.languageCode, languageCode),
          eq(keywords.locationCode, locationCode as any)
        )
      )
      .limit(1)
    return rows?.[0] ?? null
  },

  async list(websiteId: string, limit = 200) {
    if (!hasDatabase()) return []
    const db = getDb()
    return await db.select().from(keywords).where(eq(keywords.websiteId, websiteId)).limit(limit)
  },

  async count(websiteId: string): Promise<number> {
    if (!hasDatabase()) return 0
    const db = getDb()
    const rows = await db
      .select({ value: sql<number>`count(*)` })
      .from(keywords)
      .where(eq(keywords.websiteId, websiteId))
    return Number(rows?.[0]?.value ?? 0)
  },

  async removeAllForWebsite(websiteId: string) {
    if (!hasDatabase()) return
    const db = getDb()
    await db.delete(keywords).where(eq(keywords.websiteId, websiteId))
  }
}

function genId(prefix: string) { return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}` }

export function shouldActivateKeyword(keyword: { active?: boolean | null; metricsJson?: any; searchVolume?: number | null; difficulty?: number | null }): boolean {
  if (keyword.active != null) return Boolean(keyword.active)
  const metrics = keyword.metricsJson || {}
  const volume = metrics.searchVolume ?? keyword.searchVolume
  const difficulty = metrics.difficulty ?? keyword.difficulty
  if (volume == null || difficulty == null) return false
  if (!Number.isFinite(Number(volume)) || Number(volume) <= 0) return false
  if (!Number.isFinite(Number(difficulty)) || Number(difficulty) <= 0) return false
  return Number(difficulty) < 70
}
