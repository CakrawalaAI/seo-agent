import { keywordsRepo } from '@entities/keyword/repository'
import { crawlRepo } from '@entities/crawl/repository'
import { summarizeSite, expandSeeds } from '@common/providers/llm'
import { ensureCanon } from '@features/keyword/server/ensureCanon'
import { projectsRepo } from '@entities/project/repository'
import { projectDiscoveryRepo } from '@entities/project/discovery/repository'
import * as bundle from '@common/bundle/store'
import { computeOpportunity } from '@features/keyword/server/computeOpportunity'
import { filterSeeds } from '@features/keyword/server/seedFilter'
import { dfsClient } from '@common/providers/impl/dataforseo/client'
import {
  DATAFORSEO_DEFAULT_LANGUAGE_CODE,
  DATAFORSEO_DEFAULT_LOCATION_CODE
} from '@common/providers/impl/dataforseo/geo'

export async function processDiscovery(payload: { projectId: string; locale?: string }) {
  const jobStartedAt = new Date()
  const projectId = String(payload.projectId)
  const locale = payload.locale || 'en-US'
  const project = await projectsRepo.get(projectId)
  const defaultLocationCode = Number(process.env.SEOA_DEFAULT_LOCATION_CODE || String(DATAFORSEO_DEFAULT_LOCATION_CODE))
  // 1) Gather recent crawl pages from bundle
  const crawlPages = await crawlRepo.list(projectId, 200)
  const pages = crawlPages.slice(0, 50).map((p) => ({
    url: p.url,
    title: (p.metaJson as any)?.title as string | undefined,
    text: p.contentText || ''
  }))
  // 2) LLM summary + topic clusters
  const summary = await summarizeSite(pages)
  console.info('[discovery] summary generated', { projectId, hasSummary: Boolean(summary?.businessSummary), clusters: (summary?.topicClusters || []).length })
  try { if ((await import('@common/config')).config.debug?.writeBundle) { const { appendJsonl } = await import('@common/bundle/store'); appendJsonl('global', 'metrics/costs.jsonl', { node: 'llm', provider: process.env.OPENAI_API_KEY ? 'openai' : 'stub', at: new Date().toISOString(), stage: 'summarize' }) } } catch {}
  try { if ((await import('@common/config')).config.debug?.writeBundle) { bundle.writeJson(projectId, 'summary/site_summary.json', summary); bundle.appendLineage(projectId, { node: 'discovery' }) } } catch {}
  // No DB persistence of site summary (project summary field removed)
  const crawlDigest = {
    pageCount: crawlPages.length,
    sampledPages: pages.slice(0, 20).map((p) => ({ url: p.url, title: p.title ?? null }))
  }
  const providersUsed = ['llm']
  // 3) Expand seeds (LLM), derive from headings, and provider expansion (DataForSEO) → merge
  const maxLlmSeeds = Math.max(1, Number(process.env.SEOA_DISCOVERY_LLM_SEEDS_MAX || '10'))
  const seedsLlm = (await expandSeeds(summary.topicClusters || [], locale)).slice(0, maxLlmSeeds)
  console.info('[discovery] seeds from LLM', { count: seedsLlm.length })
  try { if ((await import('@common/config')).config.debug?.writeBundle) { const { appendJsonl } = await import('@common/bundle/store'); appendJsonl('global', 'metrics/costs.jsonl', { node: 'llm', provider: process.env.OPENAI_API_KEY ? 'openai' : 'stub', at: new Date().toISOString(), stage: 'expandSeeds' }) } } catch {}
  const seedInputs = new Set<string>(seedsLlm.map((s) => s.toLowerCase()))
  // derive phrases from headings in crawl dump
  try {
    const { phrasesFromHeadings } = await import('@features/keyword/server/fromHeadings')
    const headingsSource: Array<{ level: number; text: string }> = []
    for (const page of crawlPages) {
      const hs = Array.isArray(page.headingsJson) ? (page.headingsJson as Array<{ level?: number; text?: string }>) : []
      for (const h of hs) {
        headingsSource.push({ level: Number(h.level ?? 2), text: String(h.text ?? '') })
        if (headingsSource.length >= 500) break
      }
      if (headingsSource.length >= 500) break
    }
    const fromHeads = phrasesFromHeadings(headingsSource, 50)
    for (const phrase of fromHeads) {
      const key = phrase.toLowerCase()
      if (seedInputs.has(key)) continue
      seedInputs.add(key)
    }
    try {
      if ((await import('@common/config')).config.debug?.writeBundle) {
        bundle.writeJsonl(projectId, 'keywords/seeds.jsonl', [
          ...seedsLlm.map((p) => ({ phrase: p, source: 'llm' })),
          ...fromHeads.map((p) => ({ phrase: p, source: 'headings' }))
        ])
      }
    } catch {}
  } catch {}
  const dfsLanguage = project?.dfsLanguageCode || DATAFORSEO_DEFAULT_LANGUAGE_CODE
  const dfsLocation = Number(project?.metricsLocationCode || defaultLocationCode)
  const seedSnapshot = Array.from(seedInputs)
  const seedLimit = Math.max(1, Number(process.env.SEOA_DISCOVERY_SEED_LIMIT || '20'))
  const seedBatch = seedSnapshot.slice(0, seedLimit)
  if (!seedBatch.length) {
    throw new Error('No discovery seeds available after preprocessing')
  }

  const keywordRows = await dfsClient.keywordsForKeywordsDetailed({
    keywords: seedBatch,
    languageCode: dfsLanguage,
    locationCode: dfsLocation
  })
  providersUsed.push('dataforseo_keywords_for_keywords')
  if (!keywordRows.length) {
    throw new Error('DataForSEO returned no keyword suggestions')
  }

  const candidateMap = new Map<string, {
    phrase: string
    searchVolume: number
    cpc: number | null
    competition: number | null
    asOf: string | null
  }>()
  for (const row of keywordRows) {
    const phrase = String(row.keyword || '').trim()
    if (!phrase) continue
    const info = row.keyword_info || {}
    const searchVolume = Number(info?.search_volume ?? 0) || 0
    const cpcValue = typeof info?.cpc === 'number' ? Number(info.cpc) : null
    const competitionValue = typeof info?.competition === 'number' ? Number(info.competition) : null
    const asOf = typeof info?.last_updated_time === 'string' ? new Date(info.last_updated_time).toISOString() : null
    const key = phrase.toLowerCase()
    const prev = candidateMap.get(key)
    if (!prev || searchVolume > prev.searchVolume) {
      candidateMap.set(key, { phrase, searchVolume, cpc: cpcValue, competition: competitionValue, asOf })
    }
  }

  const filteredPhrases = filterSeeds(Array.from(candidateMap.keys()), summary)
  const filteredSet = new Set(filteredPhrases.map((p) => p.toLowerCase()))
  const candidates = Array.from(candidateMap.values())
    .filter((entry) => filteredSet.has(entry.phrase.toLowerCase()))
    .sort((a, b) => (b.searchVolume ?? 0) - (a.searchVolume ?? 0))

  const topLimit = Math.max(1, Number(process.env.SEOA_DISCOVERY_KEYWORD_LIMIT || '100'))
  const topCandidates = candidates.slice(0, topLimit)
  if (!topCandidates.length) {
    throw new Error('No keyword candidates remained after filtering')
  }

  const difficultyMap = await dfsClient.bulkKeywordDifficulty({
    keywords: topCandidates.map((c) => c.phrase),
    languageCode: dfsLanguage,
    locationCode: dfsLocation
  })
  providersUsed.push('dataforseo_bulk_keyword_difficulty')

  const updates: Array<{ phrase: string; metrics: { searchVolume?: number | null; difficulty?: number | null; cpc?: number | null; competition?: number | null; rankability?: number | null; asOf?: string | null } }> = []
  const finalKeywords: string[] = []
  for (const candidate of topCandidates) {
    const diff = difficultyMap.get(candidate.phrase.toLowerCase())
    const difficulty = typeof diff === 'number' && Number.isFinite(diff) ? diff : null
    const metrics = {
      searchVolume: candidate.searchVolume ?? null,
      difficulty,
      cpc: candidate.cpc,
      competition: candidate.competition,
      rankability: null,
      asOf: candidate.asOf
    }
    updates.push({ phrase: candidate.phrase, metrics })
    finalKeywords.push(candidate.phrase)
  }
  const keywordCount = finalKeywords.length

  try {
    const mappings: Array<{ phrase: string; canonId: string }> = []
    const canonLanguage = project?.dfsLanguageCode || dfsLanguage
    for (const phrase of finalKeywords) {
      const canon = await ensureCanon(phrase, canonLanguage)
      mappings.push({ phrase, canonId: canon.id })
    }
    await keywordsRepo.linkCanon(projectId, mappings)
  } catch {}

  await keywordsRepo.upsertMany(projectId, finalKeywords, dfsLanguage)

  if (updates.length) {
    await keywordsRepo.upsertMetrics(projectId, updates.map((u) => ({ phrase: u.phrase, metrics: u.metrics })))
    try { if ((await import('@common/config')).config.debug?.writeBundle) { const enrichedRows = updates.map((u) => ({ phrase: u.phrase, provider: 'dataforseo', metrics: u.metrics, opportunity: computeOpportunity({ searchVolume: u.metrics.searchVolume ?? undefined, difficulty: u.metrics.difficulty ?? undefined, competition: u.metrics.competition ?? undefined, cpc: u.metrics.cpc ?? undefined }) })); bundle.writeJsonl(projectId, 'keywords/candidates.enriched.jsonl', enrichedRows) } } catch {}
  }
  try {
    const completedAt = new Date()
    await projectDiscoveryRepo.recordRun({
      projectId,
      summary,
      seedPhrases: seedSnapshot.slice(0, 500),
      crawlDigest,
      providersUsed,
      seedCount: seedInputs.size,
      keywordCount,
      startedAt: jobStartedAt.toISOString(),
      completedAt: completedAt.toISOString()
    })
  } catch {}
  // 7) No project.summary persistence; keep bundle artifacts only
  // lineage already appended above; avoid overwriting the lineage file
}
