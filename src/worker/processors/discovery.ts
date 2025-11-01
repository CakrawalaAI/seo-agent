import { keywordsRepo } from '@entities/keyword/repository'
import { hasDatabase, getDb } from '@common/infra/db'
import { crawlPages } from '@entities/crawl/db/schema'
import { crawlRepo } from '@entities/crawl/repository'
import { summarizeSite, expandSeeds } from '@common/providers/llm'
import { getDiscoveryProvider, getMetricsProvider } from '@common/providers/registry'
import { enrichMetrics } from '@common/providers/metrics'
import { ensureCanon } from '@features/keyword/server/ensureCanon'
import { ensureMetrics } from '@features/keyword/server/ensureMetrics'
import { projectsRepo } from '@entities/project/repository'
import { eq, desc } from 'drizzle-orm'
import * as bundle from '@common/bundle/store'
import { computeOpportunity } from '@features/keyword/server/computeOpportunity'
import { filterSeeds } from '@features/keyword/server/seedFilter'
import { ensureSerpLite, computeRankability } from '@features/serp/server/serp-lite'
import { queueEnabled, publishJob } from '@common/infra/queue'
import { recordJobQueued } from '@common/infra/jobs'

export async function processDiscovery(payload: { projectId: string; locale?: string }) {
  const projectId = String(payload.projectId)
  const locale = payload.locale || 'en-US'
  // 1) Get representative pages (pull DB content if present)
  let pages: Array<{ url: string; title?: string; text?: string }> = []
  if (hasDatabase()) {
    try {
      const db = getDb()
      // @ts-ignore
      const rows = await (db.select().from(crawlPages).where(eq(crawlPages.projectId, projectId)).orderBy(desc(crawlPages.depth)).limit(50) as any)
      pages = rows.map((r: any) => ({ url: r.url, title: r?.metaJson?.title, text: r?.contentText || '' }))
    } catch {}
  }
  if (pages.length === 0) {
    const sample = await crawlRepo.list(projectId, 50)
    pages = sample.map((p: any) => ({ url: p.url, title: p?.metaJson?.title, text: '' }))
  }
  // 2) LLM summary + topic clusters
  const summary = await summarizeSite(pages)
  console.info('[discovery] summary generated', { projectId, hasSummary: Boolean(summary?.businessSummary), clusters: (summary?.topicClusters || []).length })
  try { if ((await import('@common/config')).config.debug?.writeBundle) { const { appendJsonl } = await import('@common/bundle/store'); appendJsonl('global', 'metrics/costs.jsonl', { node: 'llm', provider: process.env.OPENAI_API_KEY ? 'openai' : 'stub', at: new Date().toISOString(), stage: 'summarize' }) } } catch {}
  try { if ((await import('@common/config')).config.debug?.writeBundle) { bundle.writeJson(projectId, 'summary/site_summary.json', summary); bundle.appendLineage(projectId, { node: 'discovery' }) } } catch {}
  // No DB persistence of site summary (project summary field removed)
  // 3) Expand seeds (LLM), derive from headings, and provider expansion (DataForSEO) → merge
  const seedsLlm = await expandSeeds(summary.topicClusters || [], locale)
  console.info('[discovery] seeds from LLM', { count: seedsLlm.length })
  try { if ((await import('@common/config')).config.debug?.writeBundle) { const { appendJsonl } = await import('@common/bundle/store'); appendJsonl('global', 'metrics/costs.jsonl', { node: 'llm', provider: process.env.OPENAI_API_KEY ? 'openai' : 'stub', at: new Date().toISOString(), stage: 'expandSeeds' }) } } catch {}
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
      try { if ((await import('@common/config')).config.debug?.writeBundle) {
        bundle.writeJsonl(projectId, 'keywords/seeds.jsonl', [
          ...seedsLlm.map((p) => ({ phrase: p, source: 'llm' })),
          ...fromHeads.map((p) => ({ phrase: p, source: 'headings' }))
        ])
      } } catch {}
    }
  } catch {}
  try {
    const projL = await projectsRepo.get(projectId)
    const loc = Number((projL?.metricsLocationCode) || 2840)
    const { discoverKeywords } = await import('@features/keyword/server/discoverKeywords')
    const added = await discoverKeywords({ siteUrl: projL?.siteUrl || null, seeds: seedsLlm, language: locale, locationCode: loc })
    const set = new Set(seeds.map((s) => s.toLowerCase()))
    for (const p of added) { const k = p.toLowerCase(); if (!set.has(k)) { seeds.push(p); set.add(k) } }
    console.info('[discovery] dfs multi-source', { added: added.length })
    try { if ((await import('@common/config')).config.debug?.writeBundle) { bundle.writeJsonl(projectId, 'keywords/candidates.raw.jsonl', added.map((x) => ({ phrase: x, source: 'mixed' }))) } } catch {}
  } catch {}
  // Filter off-topic before persisting
  seeds = filterSeeds(seeds, summary)
  // 4) Upsert keywords
  await keywordsRepo.upsertMany(projectId, seeds, locale)
  try {
    // if headings write already happened above, we skip duplicate write
    if (!(hasDatabase()) && (await import('@common/config')).config.debug?.writeBundle) bundle.writeJsonl(projectId, 'keywords/seeds.jsonl', seedsLlm.map((p) => ({ phrase: p, source: 'llm' })))
  } catch {}
  // 4b) Link canons
  try {
    const mappings: Array<{ phrase: string; canonId: string }> = []
    for (const phrase of seeds.slice(0, 200)) {
      const canon = await ensureCanon(phrase, locale)
      mappings.push({ phrase, canonId: canon.id })
    }
    await keywordsRepo.linkCanon(projectId, mappings)
  } catch {}
  // 5) Scoring: bulk difficulty across candidates (cheap), then overview for top-N (rich)
  let updates: Array<{ phrase: string; metrics: any }> = []
  try {
    const month = new Date(); const asOf = `${month.getUTCFullYear()}-${String(month.getUTCMonth() + 1).padStart(2, '0')}`
    const project = await projectsRepo.get(projectId)
    const loc = Number(project?.metricsLocationCode || 2840)
    // Bulk difficulty for up to 1000
    const metricsProv = getMetricsProvider()
    const candidates = Array.from(new Set(seeds.map((s) => s.toLowerCase()))).slice(0, 1000)
    const bulk = await metricsProv.bulkDifficulty(candidates, locale, loc)
    // initial opportunity with difficulty only (volume unknown yet)
    for (const b of bulk) {
      const opp = computeOpportunity({ difficulty: b.difficulty })
      updates.push({ phrase: b.phrase, metrics: { difficulty: b.difficulty, opportunity: opp, asOf: `${asOf}-01` } })
    }
    // Rich overview for top-N easiest
    const TOP_N = Math.max(1, Number(process.env.SEOA_OVERVIEW_TOP_N || '200'))
    const easiest = [...bulk].sort((a, b) => (a.difficulty ?? 999) - (b.difficulty ?? 999)).slice(0, TOP_N)
    const over = await metricsProv.overviewBatch(easiest.map((e) => e.phrase), locale, loc)
    for (const e of easiest) {
      const info = over.get(e.phrase.toLowerCase())
      if (!info) continue
      // ensure monthly snapshot for canon
      try { const canon = await ensureCanon(e.phrase, locale); await ensureMetrics({ canon: { id: canon.id, phrase: e.phrase, language: locale }, locationCode: loc, month: asOf }) } catch {}
      // serp-lite rankability for a subset (optional)
      let rankability: number | undefined
      try { const lite = await ensureSerpLite(e.phrase, locale, loc, { cacheProjectId: projectId }); rankability = computeRankability(lite) } catch {}
      const opp = computeOpportunity({ searchVolume: info.searchVolume, difficulty: info.difficulty, competition: (info as any).competition, cpc: info.cpc, rankability })
      updates.push({ phrase: e.phrase, metrics: { searchVolume: info.searchVolume, difficulty: info.difficulty, cpc: info.cpc, competition: (info as any).competition, rankability, asOf: `${asOf}-01`, opportunity: opp } })
    }
  } catch {}
  // 6) Apply snapshot metrics if available; else provider fallback
  if (updates.length) {
    await keywordsRepo.upsertMetrics(projectId, updates.map((u) => ({ phrase: u.phrase, metrics: u.metrics as any })))
    // Write enriched candidates join (raw + metrics)
    try { if ((await import('@common/config')).config.debug?.writeBundle) { const enrichedRows = updates.map((u) => ({ phrase: u.phrase, provider: 'dataforseo', metrics: u.metrics })); bundle.writeJsonl(projectId, 'keywords/candidates.enriched.jsonl', enrichedRows) } } catch {}
  } else {
    const after = await keywordsRepo.list(projectId, { status: 'all', limit: 200 })
    const enriched = await enrichMetrics(after.map((k: any) => ({ phrase: k.phrase })), locale, undefined, projectId)
    await keywordsRepo.upsertMetrics(projectId, enriched)
  }
  // 6b) Queue prioritization via 'score' job
  try {
    if (queueEnabled()) {
      const jobId = await publishJob({ type: 'score', payload: { projectId } })
      try { await recordJobQueued(projectId, 'score', jobId) } catch {}
      console.info('[discovery] queued score', { projectId, jobId })
    }
  } catch {}
  // 6c) Optionally queue SERP for top-M to warm cache
  try {
    const TOP_M = Math.max(1, Number(process.env.SEOA_TOP_M || '50'))
    const project = await projectsRepo.get(projectId)
    const top = ((await keywordsRepo.list(projectId, { status: 'all', limit: 1000 })) || [])
      .sort((a, b) => (b.opportunity ?? 0) - (a.opportunity ?? 0))
      .slice(0, TOP_M)
    if (queueEnabled()) {
      for (const k of top) {
        const jid = await publishJob({ type: 'serp', payload: { canonPhrase: k.phrase, language: locale, locationCode: Number(project?.serpLocationCode || project?.metricsLocationCode || 2840), device: (project?.serpDevice as any) || 'desktop', topK: 10, projectId } })
        try { await recordJobQueued(projectId, 'serp', jid) } catch {}
      }
      for (const k of top.slice(0, 10)) {
        const jid = await publishJob({ type: 'competitors', payload: { projectId, siteUrl: String(project?.siteUrl || ''), canonPhrase: k.phrase, language: locale, locationCode: Number(project?.serpLocationCode || project?.metricsLocationCode || 2840), device: (project?.serpDevice as any) || 'desktop', topK: 10 } })
        try { await recordJobQueued(projectId, 'competitors', jid) } catch {}
      }
    }
  } catch {}
  // 7) No project.summary persistence; keep bundle artifacts only
  // lineage already appended above; avoid overwriting the lineage file
}
