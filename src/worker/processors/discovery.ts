import { keywordsRepo } from '@entities/keyword/repository'
import { hasDatabase, getDb } from '@common/infra/db'
import { crawlPages, linkGraph } from '@entities/crawl/db/schema'
import { crawlRepo } from '@entities/crawl/repository'
import { summarizeSite, expandSeeds } from '@common/providers/llm'
import { getExpandProvider } from '@common/providers/registry'
import { enrichMetrics } from '@common/providers/metrics'
import { ensureCanon } from '@features/keyword/server/ensureCanon'
import { ensureMetrics } from '@features/keyword/server/ensureMetrics'
import { projectsRepo } from '@entities/project/repository'
import { discoveryRepo } from '@entities/discovery/repository'
import { eq, desc } from 'drizzle-orm'
import * as bundle from '@common/bundle/store'
import { computeOpportunity } from '@features/keyword/server/computeOpportunity'
import { queueEnabled, publishJob } from '@common/infra/queue'

export async function processDiscovery(payload: { projectId: string; locale?: string }) {
  const projectId = String(payload.projectId)
  const locale = payload.locale || 'en-US'
  // 1) Get representative pages
  let pages: Array<{ url: string; title?: string; text?: string }> = []
  if (hasDatabase()) {
    try {
      const db = getDb()
      // Prefer pages with highest in-degree from link graph
      // @ts-ignore
      const edges = (await db.select().from(linkGraph).where(eq(linkGraph.projectId, projectId)) as any)
      if (Array.isArray(edges) && edges.length) {
        const indeg = new Map<string, number>()
        for (const e of edges) indeg.set(e.toUrl, (indeg.get(e.toUrl) || 0) + 1)
        const topUrls = Array.from(indeg.entries()).sort((a, b) => b[1] - a[1]).slice(0, 50).map(([u]) => u)
        // @ts-ignore
        const rows = await (db.select().from(crawlPages).where(eq(crawlPages.projectId, projectId)).limit(1000) as any)
        const byUrl = new Map<string, any>(rows.map((r: any) => [r.url, r]))
        pages = topUrls.map((u) => ({ url: u, title: ((byUrl.get(u) as any)?.metaJson)?.title }))
      }
      if (pages.length === 0) {
        // @ts-ignore
        const rows = await (db.select().from(crawlPages).where(eq(crawlPages.projectId, projectId)).orderBy(desc(crawlPages.depth)).limit(50) as any)
        pages = rows.map((r: any) => ({ url: r.url, title: r?.metaJson?.title }))
      }
    } catch {}
  }
  if (pages.length === 0) {
    const sample = crawlRepo.list(projectId, 50)
    pages = sample.map((p: any) => ({ url: p.url, title: p?.metaJson?.title }))
  }
  // 2) LLM summary + topic clusters
  const summary = await summarizeSite(pages)
  try { const { appendJsonl, } = await import('@common/bundle/store'); appendJsonl('global', 'metrics/costs.jsonl', { node: 'llm', provider: process.env.OPENAI_API_KEY ? 'openai' : 'stub', at: new Date().toISOString(), stage: 'summarize' }) } catch {}
  try { bundle.writeJson(projectId, 'summary/site_summary.json', summary); bundle.appendLineage(projectId, { node: 'discovery' }) } catch {}
  // 3) Expand seeds (LLM), derive from headings, and provider expansion (DataForSEO) → merge
  const seedsLlm = await expandSeeds(summary.topicClusters || [], locale)
  try { const { appendJsonl } = await import('@common/bundle/store'); appendJsonl('global', 'metrics/costs.jsonl', { node: 'llm', provider: process.env.OPENAI_API_KEY ? 'openai' : 'stub', at: new Date().toISOString(), stage: 'expandSeeds' }) } catch {}
  let seeds: string[] = [...seedsLlm]
  // derive phrases from headings in crawl dump
  try {
    if (hasDatabase()) {
      const db = getDb()
      // @ts-ignore
      const rows = (await db.select().from(crawlPages).where(eq(crawlPages.projectId, projectId)).limit(500)) as any
      const allHeadings: Array<{ level: number; text: string }> = []
      for (const r of rows) {
        const hs = Array.isArray(r?.headingsJson) ? (r.headingsJson as any[]) : []
        for (const h of hs) allHeadings.push({ level: Number(h.level || 2), text: String(h.text || '') })
      }
      const { phrasesFromHeadings } = await import('@features/keyword/server/fromHeadings')
      const fromHeads = phrasesFromHeadings(allHeadings, 50)
      const set = new Set(seeds.map((s) => s.toLowerCase()))
      for (const p of fromHeads) if (!set.has(p.toLowerCase())) { seeds.push(p); set.add(p.toLowerCase()) }
      try {
        bundle.writeJsonl(projectId, 'keywords/seeds.jsonl', [
          ...seedsLlm.map((p) => ({ phrase: p, source: 'llm' })),
          ...fromHeads.map((p) => ({ phrase: p, source: 'headings' }))
        ])
      } catch {}
    }
  } catch {}
  try {
    const exp = getExpandProvider()
    const expanded = await exp.expand({ phrases: seedsLlm.slice(0, 5), language: locale, locationCode: Number((projectsRepo.get(projectId)?.metricsLocationCode) || 2840), limit: 100 })
    const extra = expanded.map((e) => e.phrase)
    const set = new Set(seeds.map((s) => s.toLowerCase()))
    for (const e of extra) if (!set.has(e.toLowerCase())) { seeds.push(e); set.add(e.toLowerCase()) }
    // persist raw candidates
    try { bundle.writeJsonl(projectId, 'keywords/candidates.raw.jsonl', expanded) } catch {}
  } catch {}
  // 4) Upsert keywords
  keywordsRepo.upsertMany(projectId, seeds, locale)
  try {
    // if headings write already happened above, we skip duplicate write
    if (!(hasDatabase())) bundle.writeJsonl(projectId, 'keywords/seeds.jsonl', seedsLlm.map((p) => ({ phrase: p, source: 'llm' })))
  } catch {}
  // 4b) Link canons
  try {
    const mappings: Array<{ phrase: string; canonId: string }> = []
    for (const phrase of seeds.slice(0, 200)) {
      const canon = await ensureCanon(phrase, locale)
      mappings.push({ phrase, canonId: canon.id })
    }
    keywordsRepo.linkCanon(projectId, mappings)
  } catch {}
  // 5) Warm global metrics cache per canon (monthly) and compute opportunities
  let updates: Array<{ phrase: string; metrics: any }> = []
  try {
    const month = new Date()
    const asOf = `${month.getUTCFullYear()}-${String(month.getUTCMonth() + 1).padStart(2, '0')}`
    const project = projectsRepo.get(projectId)
    const loc = Number(project?.metricsLocationCode || 2840)
    for (const phrase of seeds.slice(0, 100)) {
      const canon = await ensureCanon(phrase, locale)
      const mm = await ensureMetrics({ canon: { id: canon.id, phrase, language: locale }, locationCode: loc, month: asOf })
      const opp = computeOpportunity({ searchVolume: mm?.searchVolume, difficulty: mm?.difficulty, competition: mm?.competition, cpc: mm?.cpc })
      updates.push({ phrase, metrics: { searchVolume: mm?.searchVolume, difficulty: mm?.difficulty, cpc: mm?.cpc, asOf: `${asOf}-01`, opportunity: opp } })
      try { const { appendJsonl } = await import('@common/bundle/store'); appendJsonl('global', 'metrics/costs.jsonl', { node: 'metrics', provider: 'dataforseo', at: new Date().toISOString(), canonPhrase: phrase, locationCode: loc, month: asOf }) } catch {}
    }
  } catch {}
  // 6) Apply snapshot metrics if available; else provider fallback
  if (updates.length) {
    keywordsRepo.upsertMetrics(projectId, updates.map((u) => ({ phrase: u.phrase, metrics: u.metrics as any })))
    // Write enriched candidates join (raw + metrics)
    try {
      const enrichedRows = updates.map((u) => ({ phrase: u.phrase, provider: 'dataforseo', metrics: u.metrics }))
      bundle.writeJsonl(projectId, 'keywords/candidates.enriched.jsonl', enrichedRows)
    } catch {}
  } else {
    const after = keywordsRepo.list(projectId, { status: 'all', limit: 200 })
    const enriched = await enrichMetrics(after.map((k) => ({ phrase: k.phrase })), locale, undefined, projectId)
    keywordsRepo.upsertMetrics(projectId, enriched)
  }
  // 6b) Prioritization handled by 'score' job; skip writing prioritized here
  // 6c) Optionally queue SERP for top-M to warm cache
  try {
    const TOP_M = Math.max(1, Number(process.env.SEOA_TOP_M || '50'))
    const project = projectsRepo.get(projectId)
    const top = (keywordsRepo.list(projectId, { status: 'all', limit: 1000 }) || [])
      .sort((a, b) => (b.opportunity ?? 0) - (a.opportunity ?? 0))
      .slice(0, TOP_M)
    if (queueEnabled()) {
      for (const k of top) {
        await publishJob({ type: 'serp', payload: { canonPhrase: k.phrase, language: locale, locationCode: Number(project?.serpLocationCode || project?.metricsLocationCode || 2840), device: (project?.serpDevice as any) || 'desktop', topK: 10 } })
      }
      for (const k of top.slice(0, 10)) {
        await publishJob({ type: 'competitors', payload: { projectId, siteUrl: String(project?.siteUrl || ''), canonPhrase: k.phrase, language: locale, locationCode: Number(project?.serpLocationCode || project?.metricsLocationCode || 2840), device: (project?.serpDevice as any) || 'desktop', topK: 10 } })
      }
    }
  } catch {}
  // 7) Record discovery
  const now = new Date().toISOString()
  discoveryRepo.record(projectId, {
    providersUsed: ['crawl', process.env.OPENAI_API_KEY ? 'llm' : 'stub', process.env.DATAFORSEO_LOGIN ? 'dataforseo' : 'pseudo'],
    startedAt: now,
    finishedAt: now,
    status: 'completed',
    summaryJson: summary,
    costMeterJson: { approximate: true }
  })
  // lineage already appended above; avoid overwriting the lineage file
}
