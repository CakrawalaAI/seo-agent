import { hasDatabase, getDb } from '@common/infra/db'
import { keywords } from './db/schema.keywords'
import { and, eq, sql } from 'drizzle-orm'

export const keywordsRepo = {
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
        .insert(keywords)
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
          target: [keywords.websiteId, keywords.phraseNorm, keywords.languageCode, keywords.locationCode],
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
        .delete(keywords)
        .where(
          and(
            eq(keywords.websiteId, input.websiteId),
            eq(keywords.phraseNorm, input.phraseNorm),
            eq(keywords.languageCode, input.languageCode),
            eq(keywords.locationCode, input.locationCode as any)
          )
        )
      await db.insert(keywords).values({
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
      .from(keywords)
      .where(
        and(
          eq(keywords.websiteId, websiteId),
          eq(keywords.phraseNorm, phraseNorm),
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
