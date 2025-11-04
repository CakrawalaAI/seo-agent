import { summarizeSite, expandSeeds } from '@common/providers/llm'
import { websitesRepo } from '@entities/website/repository'
import { filterSeeds } from '@features/keyword/server/seedFilter'
import { dfsClient } from '@common/providers/impl/dataforseo/client'
import { getDevFlags } from '@common/dev/flags'
import { DATAFORSEO_DEFAULT_LANGUAGE_CODE, DATAFORSEO_DEFAULT_LOCATION_CODE } from '@common/providers/impl/dataforseo/geo'
import { languageCodeFromLocale, languageNameFromCode, locationCodeFromLocale, locationNameFromCode } from '@common/providers/impl/dataforseo/geo-map'
import { log } from '@src/common/logger'
import { websiteCrawlRepo } from '@entities/crawl/repository.website'
import { websiteKeywordsRepo } from '@entities/keyword/repository.website_keywords'

export async function processDiscovery(payload: { projectId?: string; websiteId?: string; locale?: string; languageCode?: string; locationCode?: number }) {
  const websiteId = String(payload.websiteId || payload.projectId)
  const locale = payload.locale || 'en-US'
  const website = await websitesRepo.get(websiteId)
  if (!website) { log.warn('[discovery] website not found', { websiteId }); return }

  // 1) Summarize site (from recent crawl pages)
  const crawlPages = await websiteCrawlRepo.listRecentPages(websiteId, 120)
  const pages = crawlPages.slice(0, 50).map((p) => ({ url: p.url, title: (p.title as string | undefined) || undefined, text: (p as any).content || '' }))
  const summary = await summarizeSite(pages)
  try { await websitesRepo.patch(websiteId, { summary: summary.businessSummary || null, status: 'crawled' }) } catch {}

  // 2) Seeds via LLM (10)
  const devFlags = getDevFlags()
  const maxLlmSeeds = Math.max(1, devFlags.discovery.llmSeedsMax)
  const seedsLlm = (await expandSeeds(summary.topicClusters || [], locale)).slice(0, maxLlmSeeds)
  const seedInputs = new Set<string>(seedsLlm.map((s) => s.toLowerCase()))
  const seedBatch = Array.from(seedInputs).slice(0, Math.max(1, devFlags.discovery.seedLimit))
  if (!seedBatch.length) throw new Error('No discovery seeds available after preprocessing')

  // 3) One call: keyword_ideas/live (no SERP info)
  const dfsLanguage = payload.languageCode || languageCodeFromLocale(website?.defaultLocale || payload.locale) || DATAFORSEO_DEFAULT_LANGUAGE_CODE
  const dfsLocation = Number(payload.locationCode || locationCodeFromLocale(website?.defaultLocale || payload.locale) || DATAFORSEO_DEFAULT_LOCATION_CODE)
  const ideasLimit = Math.min(30, Math.max(1, devFlags.discovery.keywordLimit))
  const ideas = await dfsClient.keywordIdeasDetailed({ keywords: seedBatch, languageCode: dfsLanguage, locationCode: dfsLocation, limit: ideasLimit })
  if (!ideas.length) throw new Error('DataForSEO returned no keyword ideas')

  // 4) Persist into website_keywords
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')
  const langName = languageNameFromCode(dfsLanguage)
  const locationName = locationNameFromCode(dfsLocation)
  const now = new Date().toISOString()
  // Decide auto-include: top 20 by (difficulty ASC, volume DESC) where difficulty < 70
  type IdeaRow = typeof ideas[number]
  const withMetrics = ideas.map((row) => {
    const phrase = String(row.keyword || '').trim()
    const info = row.keyword_info || {}
    const props = row.keyword_properties || {}
    const vol = Number(info?.search_volume ?? 0) || 0
    const kd = typeof props?.keyword_difficulty === 'number' ? Number(props.keyword_difficulty) : Number.NaN
    return { phrase, vol, kd, row }
  }).filter((x) => x.phrase)
  const candidates = withMetrics.filter((x) => Number.isFinite(x.kd) && x.kd < 70)
    .sort((a, b) => (a.kd - b.kd) || (b.vol - a.vol))
    .slice(0, Math.min(20, withMetrics.length))
  const includeSet = new Set(candidates.map((c) => c.phrase.toLowerCase()))

  const filtered = filterSeeds(ideas.map((i) => String(i.keyword || '')), summary)
  let inserted = 0
  const limit = ideasLimit
  for (const phrase of filtered) {
    if (!phrase || inserted >= limit) break
    const row = ideas.find((i) => String(i.keyword || '').trim().toLowerCase() === phrase.trim().toLowerCase())
    if (!row) continue
    const info = row.keyword_info || {}
    const props = row.keyword_properties || {}
    const monthly = Array.isArray(info?.monthly_searches)
      ? info.monthly_searches.map((m: any) => ({ month: `${m?.year ?? ''}-${String(m?.month ?? 1).padStart(2, '0')}`, searchVolume: Number(m?.search_volume ?? 0) }))
          .filter((x: any) => x.month && Number.isFinite(x.searchVolume))
      : null
    await websiteKeywordsRepo.upsert({
      websiteId,
      phrase,
      phraseNorm: norm(phrase),
      languageCode: dfsLanguage,
      languageName: langName,
      locationCode: dfsLocation,
      locationName,
      provider: 'dataforseo.labs.keyword_ideas',
      include: includeSet.has(phrase.toLowerCase()),
      searchVolume: Number(info?.search_volume ?? 0) || 0,
      cpc: typeof info?.cpc === 'number' ? Number(info.cpc) : null,
      competition: typeof info?.competition === 'number' ? Number(info.competition) : null,
      difficulty: typeof props?.keyword_difficulty === 'number' ? Number(props.keyword_difficulty) : null,
      vol12m: monthly,
      impressions: row.impressions_info || null,
      raw: row as any,
      metricsAsOf: now
    })
    inserted++
  }
  try { await websitesRepo.patch(websiteId, { status: 'keyword_generated' }) } catch {}
}
