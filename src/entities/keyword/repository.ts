import type { Keyword, KeywordMetrics } from './domain/keyword'
import { hasDatabase, getDb } from '@common/infra/db'
import { keywords } from './db/schema'
import { eq, and, desc } from 'drizzle-orm'

export const keywordsRepo = {
  async generate(projectId: string, locale = 'en-US'): Promise<{ jobId: string; added: number }> {
    const now = new Date()
    const base = sampleSeeds()
    const items: Keyword[] = base.map((phrase) => {
      const mk = mkMetrics()
      const opp = computeOpportunity(mk.searchVolume ?? null, mk.difficulty ?? null)
      return {
        id: genId('kw'),
        projectId,
        phrase,
        status: 'recommended',
        starred: false,
        opportunity: opp,
        metricsJson: mk,
        createdAt: undefined as any,
        updatedAt: undefined as any
      }
    })
    if (hasDatabase()) { const db = getDb(); const values = items.map(i => ({ id: i.id, projectId: i.projectId, phrase: i.phrase, status: i.status, starred: i.starred, opportunity: i.opportunity, metricsJson: i.metricsJson as any })); await db.insert(keywords).values(values as any).onConflictDoNothing?.() }
    return { jobId: genId('job'), added: items.length }
  },

  async list(projectId: string, opts: { status?: string; limit?: number } = {}): Promise<Keyword[]> {
    const limit = opts.limit && opts.limit > 0 ? opts.limit : 100
    const status = opts.status && opts.status !== 'all' ? String(opts.status) : null
    if (!hasDatabase()) return []
    const db = getDb()
    let q = db.select().from(keywords).where(eq(keywords.projectId, projectId)).limit(limit)
    if (status) {
      // @ts-ignore
      q = db.select().from(keywords).where(and(eq(keywords.projectId, projectId), eq(keywords.status as any, status))).limit(limit)
    }
    const rows = (await q) as any[]
    return rows as any
  },

  async upsertMetrics(projectId: string, updates: Array<{ phrase: string; metrics: KeywordMetrics }>): Promise<number> {
    if (!hasDatabase() || !updates.length) return 0
    const db = getDb()
    let updated = 0
    for (const u of updates) {
      // find keyword id by (projectId, phrase)
      const rows = await db.select().from(keywords).where(and(eq(keywords.projectId, projectId), eq(keywords.phrase, u.phrase))).limit(1)
      const row: any = rows?.[0]
      if (!row) continue
      const opportunity = computeOpportunity((u.metrics as any)?.searchVolume, (u.metrics as any)?.difficulty, (u.metrics as any)?.rankability)
      await db.update(keywords).set({ metricsJson: u.metrics as any, opportunity, updatedAt: new Date() as any }).where(eq(keywords.id, row.id))
      updated++
    }
    return updated
  },
  async upsertMany(projectId: string, phrases: string[], locale = 'en-US'): Promise<number> {
    if (!phrases.length) return 0
    const now = new Date()
    const toAdd: Keyword[] = []
    const db = hasDatabase() ? getDb() : null
    for (const p of phrases) {
      const phrase = String(p || '').trim()
      if (!phrase) continue
      toAdd.push({ id: genId('kw'), projectId, phrase, status: 'recommended', metricsJson: mkMetrics(), createdAt: undefined as any, updatedAt: undefined as any })
    }
    if (db) { const values = toAdd.map(i => ({ id: i.id, projectId: i.projectId, phrase: i.phrase, status: i.status, metricsJson: i.metricsJson as any })); await db.insert(keywords).values(values as any).onConflictDoNothing?.() }
    return toAdd.length
  },
  async linkCanon(projectId: string, mappings: Array<{ phrase: string; canonId: string }>): Promise<number> {
    if (!mappings.length || !hasDatabase()) return 0
    const db = getDb()
    let count = 0
    for (const m of mappings) {
      const rows = await db.select().from(keywords).where(and(eq(keywords.projectId, projectId), eq(keywords.phrase, m.phrase))).limit(1)
      const row: any = rows?.[0]
      if (!row) continue
      await db.update(keywords).set({ canonId: m.canonId, updatedAt: new Date() as any }).where(eq(keywords.id, row.id))
      count++
    }
    return count
  },
  async update(id: string, patch: Partial<Keyword>): Promise<Keyword | null> {
    if (!hasDatabase()) return null
    const db = getDb()
    const set: any = { updatedAt: new Date() as any }
    if (patch.phrase !== undefined) set.phrase = patch.phrase
    if (patch.status !== undefined) set.status = patch.status
    if (patch.starred !== undefined) set.starred = Boolean(patch.starred)
    if (patch.opportunity !== undefined) set.opportunity = patch.opportunity
    if (patch.metricsJson !== undefined) set.metricsJson = patch.metricsJson as any
    await db.update(keywords).set(set).where(eq(keywords.id, id))
    const out = await db.select().from(keywords).where(eq(keywords.id, id)).limit(1)
    return (out?.[0] as any) ?? null
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

function mkMetrics(): KeywordMetrics {
  const volume = Math.floor(100 + Math.random() * 5000)
  const difficulty = Math.floor(10 + Math.random() * 70)
  const cpc = Number((Math.random() * 5).toFixed(2))
  return { searchVolume: volume, difficulty, cpc, asOf: new Date().toISOString() }
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

function computeOpportunity(volume: number | null | undefined, difficulty: number | null | undefined, rankability?: number | null | undefined) {
  const v = typeof volume === 'number' && isFinite(volume) ? Math.max(0, Math.min(10000, volume)) : 0
  const d = typeof difficulty === 'number' && isFinite(difficulty) ? Math.max(0, Math.min(100, difficulty)) : 50
  const vNorm = Math.min(1, Math.log10(1 + v) / 4)
  const diffNorm = 1 - d / 100
  const base = Math.round(100 * (0.7 * vNorm + 0.3 * diffNorm))
  if (typeof rankability === 'number' && isFinite(rankability)) {
    return Math.max(0, Math.min(100, Math.round(0.5 * base + 0.5 * Math.max(0, Math.min(100, rankability)))))
  }
  return Math.max(0, Math.min(100, base))
}
