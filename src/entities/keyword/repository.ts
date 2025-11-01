import type { Keyword, KeywordMetrics } from './domain/keyword'
import { hasDatabase, getDb } from '@common/infra/db'
import { keywords } from './db/schema'
import { keywordCanon } from './db/schema.canon'
import { metricCache } from '@entities/metrics/db/schema'
import { and, asc, eq } from 'drizzle-orm'

export const keywordsRepo = {
  async generate(projectId: string, locale = 'en-US'): Promise<{ jobId: string; added: number }> {
    const phrases = sampleSeeds()
    if (!hasDatabase()) {
      return { jobId: genId('job'), added: phrases.length }
    }
    const db = getDb()
    let added = 0
    for (const phrase of phrases) {
      const normalized = normalizePhrase(phrase)
      const canonId = canonIdFor(normalized, locale)
      try {
        await db
          .insert(keywordCanon)
          .values({ id: canonId, phraseNorm: normalized, languageCode: locale })
          .onConflictDoNothing?.()
      } catch {}
      try {
        await db
          .insert(keywords)
          .values({ id: genId('kw'), projectId, canonId, status: 'recommended', starred: false })
          .onConflictDoNothing?.()
        added++
      } catch {}
    }
    return { jobId: genId('job'), added }
  },

  async list(projectId: string, opts: { status?: string; limit?: number } = {}): Promise<Keyword[]> {
    if (!hasDatabase()) return []
    const db = getDb()
    const limit = opts.limit && opts.limit > 0 ? opts.limit : 100
    const base = db
      .select({
        id: keywords.id,
        projectId: keywords.projectId,
        canonId: keywords.canonId,
        status: keywords.status,
        starred: keywords.starred,
        createdAt: keywords.createdAt,
        updatedAt: keywords.updatedAt,
        phraseNorm: keywordCanon.phraseNorm,
        metricsJson: metricCache.metricsJson
      })
      .from(keywords)
      .innerJoin(keywordCanon, eq(keywords.canonId, keywordCanon.id))
      .leftJoin(metricCache, eq(metricCache.canonId, keywordCanon.id))
      .where(eq(keywords.projectId, projectId))
      .orderBy(asc(keywordCanon.phraseNorm))
      .limit(limit)
    let rows = await base
    if (opts.status && opts.status !== 'all') {
      rows = rows.filter((r) => String(r.status) === opts.status)
    }
    return rows.map((row) => composeKeyword(row))
  },

  async upsertMetrics(projectId: string, updates: Array<{ phrase: string; metrics: KeywordMetrics }>): Promise<number> {
    if (!hasDatabase() || !updates.length) return 0
    const db = getDb()
    let updated = 0
    for (const u of updates) {
      const normalized = normalizePhrase(u.phrase)
      const canonRow = await ensureCanonRow(db, normalized, 'en-US')
      if (!canonRow) continue
      try {
        await db
          .insert(metricCache)
          .values({
            id: genId('mcache'),
            canonId: canonRow.id,
            provider: 'dataforseo',
            metricsJson: u.metrics as any,
            ttlSeconds: 30 * 24 * 60 * 60
          })
          .onConflictDoUpdate({
            target: [metricCache.canonId],
            set: { metricsJson: u.metrics as any, fetchedAt: new Date() as any }
          })
        updated++
      } catch {}
    }
    return updated
  },

  async upsertMany(projectId: string, phrases: string[], locale = 'en-US'): Promise<number> {
    if (!phrases.length) return 0
    if (!hasDatabase()) return phrases.length
    const db = getDb()
    let inserted = 0
    for (const raw of phrases) {
      const phrase = String(raw || '').trim()
      if (!phrase) continue
      const normalized = normalizePhrase(phrase)
      const canonId = canonIdFor(normalized, locale)
      try {
        await db
          .insert(keywordCanon)
          .values({ id: canonId, phraseNorm: normalized, languageCode: locale })
          .onConflictDoNothing?.()
      } catch {}
      try {
        await db
          .insert(keywords)
          .values({ id: genId('kw'), projectId, canonId, status: 'recommended', starred: false })
          .onConflictDoNothing?.()
        inserted++
      } catch {}
    }
    return inserted
  },

  async linkCanon(_projectId: string, _mappings: Array<{ phrase: string; canonId: string }>): Promise<number> {
    // keywords now require canonId on insert; keep method for compatibility
    return 0
  },

  async update(id: string, patch: Partial<Keyword>): Promise<Keyword | null> {
    if (!hasDatabase()) return null
    const db = getDb()
    const set: any = { updatedAt: new Date() as any }
    if (patch.status !== undefined) set.status = patch.status
    if (patch.starred !== undefined) set.starred = Boolean(patch.starred)
    await db.update(keywords).set(set).where(eq(keywords.id, id))
    const rows = await db
      .select({
        id: keywords.id,
        projectId: keywords.projectId,
        canonId: keywords.canonId,
        status: keywords.status,
        starred: keywords.starred,
        createdAt: keywords.createdAt,
        updatedAt: keywords.updatedAt,
        phraseNorm: keywordCanon.phraseNorm,
        metricsJson: metricCache.metricsJson
      })
      .from(keywords)
      .innerJoin(keywordCanon, eq(keywords.canonId, keywordCanon.id))
      .leftJoin(metricCache, eq(metricCache.canonId, keywordCanon.id))
      .where(eq(keywords.id, id))
      .limit(1)
    const row = rows?.[0]
    return row ? composeKeyword(row) : null
  },

  async remove(id: string): Promise<boolean> {
    if (!hasDatabase()) return false
    const db = getDb()
    await db.delete(keywords).where(eq(keywords.id, id))
    return true
  },

  async removeByProject(projectId: string) {
    if (!hasDatabase()) return
    const db = getDb()
    await db.delete(keywords).where(eq(keywords.projectId, projectId))
  }
}

function composeKeyword(row: {
  id: string
  projectId: string
  canonId: string
  status: string | null
  starred: boolean | null
  createdAt: Date | string | null
  updatedAt: Date | string | null
  phraseNorm: string
  metricsJson: Record<string, unknown> | null
}): Keyword {
  const metrics = (row.metricsJson || null) as KeywordMetrics | null
  const opportunity = computeOpportunity(
    Number((metrics as any)?.searchVolume ?? null),
    Number((metrics as any)?.difficulty ?? null),
    Number((metrics as any)?.rankability ?? null)
  )
  return {
    id: row.id,
    projectId: row.projectId,
    canonId: row.canonId,
    phrase: row.phraseNorm,
    status: row.status || 'recommended',
    starred: Boolean(row.starred),
    metricsJson: metrics,
    opportunity,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null
  }
}

function normalizePhrase(raw: string) {
  return raw.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase()
}

function canonIdFor(phraseNorm: string, language: string) {
  return `kcan_${Buffer.from(`${phraseNorm}|${language}`).toString('base64').slice(0, 20)}`
}

async function ensureCanonRow(db: ReturnType<typeof getDb>, phraseNorm: string, language: string) {
  const id = canonIdFor(phraseNorm, language)
  try {
    await db
      .insert(keywordCanon)
      .values({ id, phraseNorm, languageCode: language })
      .onConflictDoNothing?.()
    return { id }
  } catch {
    const rows = await db.select().from(keywordCanon).where(and(eq(keywordCanon.id, id), eq(keywordCanon.languageCode, language))).limit(1)
    const row = rows?.[0]
    if (row) return { id: row.id }
    return null
  }
}

function sampleSeeds() {
  return [
    'seo automation',
    'programmatic seo',
    'webflow blog seo',
    'keyword research workflow',
    'content calendar generator',
    'ai article generator',
    'lazy content generation',
    'webhook publishing',
    'rabbitmq job queue',
    'llm content outline'
  ]
}

function genId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function computeOpportunity(
  volume: number | null | undefined,
  difficulty: number | null | undefined,
  rankability?: number | null | undefined
) {
  if (typeof volume !== 'number' || !Number.isFinite(volume)) volume = 0
  if (typeof difficulty !== 'number' || !Number.isFinite(difficulty)) difficulty = 50
  const vNorm = Math.min(1, Math.log10(1 + Math.max(0, volume)) / 4)
  const diffNorm = 1 - Math.max(0, Math.min(100, difficulty)) / 100
  const base = Math.round(100 * (0.7 * vNorm + 0.3 * diffNorm))
  if (typeof rankability === 'number' && Number.isFinite(rankability)) {
    return Math.max(0, Math.min(100, Math.round(0.5 * base + 0.5 * Math.max(0, Math.min(100, rankability)))))
  }
  return Math.max(0, Math.min(100, base))
}
