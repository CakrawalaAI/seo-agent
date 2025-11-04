import { hasDatabase, getDb } from '@common/infra/db'
import { websiteKeywords } from './db/schema.website_keywords'
import { and, eq } from 'drizzle-orm'

export const websiteKeywordsRepo = {
  async upsert(input: {
    websiteId: string
    phrase: string
    phraseNorm: string
    languageCode: string
    languageName: string
    locationCode: number
    locationName: string
    provider?: string
    include?: boolean
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
        .insert(websiteKeywords)
        .values({
          id,
          websiteId: input.websiteId,
          phrase: input.phrase,
          phraseNorm: input.phraseNorm,
          languageCode: input.languageCode,
          languageName: input.languageName,
          locationCode: input.locationCode,
          locationName: input.locationName,
          provider,
          include: Boolean(input.include) as any,
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
          target: [websiteKeywords.websiteId, websiteKeywords.phraseNorm, websiteKeywords.languageCode, websiteKeywords.locationCode],
          set: {
            provider,
            // do not touch include on updates; preserve user choice
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
      return await this.getByKey(input.websiteId, input.phraseNorm, input.languageCode, input.locationCode)
    } catch {
      // Fallback: delete existing then insert
      await db
        .delete(websiteKeywords)
        .where(
          and(
            eq(websiteKeywords.websiteId, input.websiteId),
            eq(websiteKeywords.phraseNorm, input.phraseNorm),
            eq(websiteKeywords.languageCode, input.languageCode),
            eq(websiteKeywords.locationCode, input.locationCode as any)
          )
        )
      await db.insert(websiteKeywords).values({
        id,
        websiteId: input.websiteId,
        phrase: input.phrase,
        phraseNorm: input.phraseNorm,
        languageCode: input.languageCode,
        languageName: input.languageName,
        locationCode: input.locationCode,
        locationName: input.locationName,
        provider,
        include: Boolean(input.include) as any,
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
      return await this.getByKey(input.websiteId, input.phraseNorm, input.languageCode, input.locationCode)
    }
  },

  async getByKey(websiteId: string, phraseNorm: string, languageCode: string, locationCode: number) {
    if (!hasDatabase()) return null
    const db = getDb()
    const rows = await db
      .select()
      .from(websiteKeywords)
      .where(
        and(
          eq(websiteKeywords.websiteId, websiteId),
          eq(websiteKeywords.phraseNorm, phraseNorm),
          eq(websiteKeywords.languageCode, languageCode),
          eq(websiteKeywords.locationCode, locationCode as any)
        )
      )
      .limit(1)
    return rows?.[0] ?? null
  },

  async list(websiteId: string, limit = 200) {
    if (!hasDatabase()) return []
    const db = getDb()
    return await db.select().from(websiteKeywords).where(eq(websiteKeywords.websiteId, websiteId)).limit(limit)
  }
}

function genId(prefix: string) { return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}` }
