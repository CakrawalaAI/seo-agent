import type { Keyword, KeywordMetrics } from './domain/keyword'

const byProject = new Map<string, Keyword[]>()

export const keywordsRepo = {
  generate(projectId: string, locale = 'en-US'): { jobId: string; added: number } {
    const now = new Date().toISOString()
    const base = sampleSeeds()
    const items: Keyword[] = base.map((phrase) => ({
      id: genId('kw'),
      projectId,
      phrase,
      status: 'recommended',
      metricsJson: mkMetrics(),
      createdAt: now,
      updatedAt: now
    }))
    const current = byProject.get(projectId) ?? []
    byProject.set(projectId, dedupe([...items, ...current]))
    return { jobId: genId('job'), added: items.length }
  },

  list(projectId: string, opts: { status?: string; limit?: number } = {}) {
    const all = byProject.get(projectId) ?? []
    const status = opts.status && opts.status !== 'all' ? String(opts.status) : null
    const filtered = status ? all.filter((k) => (k.status ?? 'recommended') === status) : all
    const limit = opts.limit && opts.limit > 0 ? opts.limit : 100
    return filtered.slice(0, limit)
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

