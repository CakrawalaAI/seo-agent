import type { Keyword, KeywordMetrics } from './domain/keyword'
import { hasDatabase, getDb } from '@common/infra/db'
import { keywords } from './db/schema'
import { discoveryRepo } from '@entities/discovery/repository'

const byProject = new Map<string, Keyword[]>()

export const keywordsRepo = {
  generate(projectId: string, locale = 'en-US'): { jobId: string; added: number } {
    const now = new Date().toISOString()
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
        createdAt: now,
        updatedAt: now
      }
    })
    const current = byProject.get(projectId) ?? []
    byProject.set(projectId, dedupe([...items, ...current]))
    if (hasDatabase()) void (async () => { try { const db = getDb(); await db.insert(keywords).values(items as any).onConflictDoNothing?.(); } catch {} })()
    discoveryRepo.record(projectId, {
      providersUsed: ['crawl', 'llm'],
      startedAt: now,
      finishedAt: now,
      status: 'completed',
      costMeterJson: { approximate: true },
      summaryJson: {
        businessSummary: 'Auto-generated discovery summary',
        topicClusters: Array.from(new Set(items.map((i) => i.phrase.split(' ')[0]))).slice(0, 5)
      }
    })
    return { jobId: genId('job'), added: items.length }
  },

  list(projectId: string, opts: { status?: string; limit?: number } = {}) {
    const all = byProject.get(projectId) ?? []
    const status = opts.status && opts.status !== 'all' ? String(opts.status) : null
    const filtered = status ? all.filter((k) => (k.status ?? 'recommended') === status) : all
    const limit = opts.limit && opts.limit > 0 ? opts.limit : 100
    return filtered.slice(0, limit)
  },

  upsertMetrics(projectId: string, updates: Array<{ phrase: string; metrics: KeywordMetrics }>) {
    const list = byProject.get(projectId) ?? []
    if (!list.length) return 0
    let updated = 0
    for (const u of updates) {
      const idx = list.findIndex((k) => k.phrase.toLowerCase() === u.phrase.toLowerCase())
      if (idx >= 0) {
        const opp = computeOpportunity(u.metrics?.searchVolume ?? null, u.metrics?.difficulty ?? null)
        list[idx] = { ...list[idx]!, metricsJson: u.metrics, opportunity: opp, updatedAt: new Date().toISOString() }
        updated++
      }
    }
    byProject.set(projectId, list)
    if (updated && hasDatabase()) void (async () => {
      try {
        const db = getDb()
        for (const u of updates) {
          const row = list.find((k) => k.phrase.toLowerCase() === u.phrase.toLowerCase())
          if (row) {
            await db.update(keywords).set({ metricsJson: u.metrics, opportunity: row.opportunity ?? computeOpportunity((u.metrics as any)?.searchVolume, (u.metrics as any)?.difficulty), updatedAt: new Date() as any }).where((keywords as any).id.eq(row.id))
          }
        }
      } catch {}
    })()
    return updated
  }
  ,
  upsertMany(projectId: string, phrases: string[], locale = 'en-US'): number {
    if (!phrases.length) return 0
    const now = new Date().toISOString()
    const current = byProject.get(projectId) ?? []
    const existingSet = new Set(current.map((k) => k.phrase.toLowerCase()))
    const toAdd: Keyword[] = []
    for (const p of phrases) {
      const phrase = String(p || '').trim()
      if (!phrase) continue
      const key = phrase.toLowerCase()
      if (!existingSet.has(key)) {
        toAdd.push({ id: genId('kw'), projectId, phrase, status: 'recommended', metricsJson: mkMetrics(), createdAt: now, updatedAt: now })
        existingSet.add(key)
      }
    }
    if (toAdd.length === 0) return 0
    byProject.set(projectId, dedupe([...toAdd, ...current]))
    if (hasDatabase()) void (async () => { try { const db = getDb(); await db.insert(keywords).values(toAdd as any).onConflictDoNothing?.(); } catch {} })()
    return toAdd.length
  },
  linkCanon(projectId: string, mappings: Array<{ phrase: string; canonId: string }>) {
    if (!mappings.length) return 0
    const list = byProject.get(projectId) ?? []
    const byPhrase = new Map(mappings.map((m) => [m.phrase.toLowerCase(), m.canonId]))
    let count = 0
    for (let i = 0; i < list.length; i++) {
      const canonId = byPhrase.get(list[i]!.phrase.toLowerCase())
      if (canonId && list[i]!.canonId !== canonId) {
        list[i] = { ...list[i]!, canonId }
        count++
      }
    }
    if (count) byProject.set(projectId, list)
    if (count && hasDatabase()) void (async () => {
      try {
        const db = getDb()
        for (const [phraseLower, canonId] of byPhrase) {
          const row = list.find((k) => k.phrase.toLowerCase() === phraseLower)
          if (row) {
            await db.update(keywords).set({ canonId }).where((keywords as any).id.eq(row.id))
          }
        }
      } catch {}
    })()
    return count
  },
  update(id: string, patch: Partial<Keyword>): Keyword | null {
    const list = byProject.get((patch as any)?.projectId || '') || []
    for (const [projectId, items] of byProject.entries()) {
      const idx = items.findIndex((k) => k.id === id)
      if (idx >= 0) {
        const next: Keyword = { ...items[idx]!, ...patch, updatedAt: new Date().toISOString() }
        items[idx] = next
        byProject.set(projectId, items)
        if (hasDatabase()) void (async () => { try { const db = getDb(); await db.update(keywords).set({ phrase: next.phrase, status: next.status, starred: Boolean(next.starred), opportunity: next.opportunity ?? null, metricsJson: next.metricsJson, updatedAt: new Date() as any } as any).where((keywords as any).id.eq(id)); } catch {} })()
        return next
      }
    }
    return null
  },
  remove(id: string): boolean {
    for (const [projectId, items] of byProject.entries()) {
      const idx = items.findIndex((k) => k.id === id)
      if (idx >= 0) {
        items.splice(idx, 1)
        byProject.set(projectId, items)
        if (hasDatabase()) void (async () => { try { const db = getDb(); await db.delete(keywords).where((keywords as any).id.eq(id)); } catch {} })()
        return true
      }
    }
    return false
  },
  removeByProject(projectId: string) {
    byProject.delete(projectId)
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

function dedupe(items: Keyword[]) {
  const seen = new Set<string>()
  const out: Keyword[] = []
  for (const k of items) {
    const key = `${k.projectId}:${k.phrase.toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(k)
  }
  return out
}

function computeOpportunity(volume: number | null | undefined, difficulty: number | null | undefined) {
  const v = typeof volume === 'number' && isFinite(volume) ? Math.max(0, Math.min(10000, volume)) : 0
  const d = typeof difficulty === 'number' && isFinite(difficulty) ? Math.max(0, Math.min(100, difficulty)) : 50
  const vNorm = Math.min(1, Math.log10(1 + v) / 4)
  const diffNorm = 1 - d / 100
  const score = Math.round(100 * (0.7 * vNorm + 0.3 * diffNorm))
  return Math.max(0, Math.min(100, score))
}
