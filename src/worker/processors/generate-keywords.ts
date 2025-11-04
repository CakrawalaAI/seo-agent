import { summarizeSite, expandSeeds } from '@common/providers/llm'
import { websitesRepo } from '@entities/website/repository'
import { filterSeeds } from '@features/keyword/server/seedFilter'
import { mockKeywordGenerator } from '@common/providers/impl/mock/keyword-generator'
import { keywordIdeas as fetchKeywordIdeas } from '@common/providers/impl/dataforseo/keyword-ideas'
import { keywordConfig } from '@common/dev/flags'
import {
  DATAFORSEO_DEFAULT_LANGUAGE_CODE,
  DATAFORSEO_DEFAULT_LOCATION_CODE,
  languageCodeFromLocale,
  languageNameFromCode,
  locationCodeFromLocale,
  locationNameFromCode
} from '@common/providers/impl/dataforseo/geo'
import { log } from '@src/common/logger'
import { crawlRepo } from '@entities/crawl/repository'
import { keywordsRepo } from '@entities/keyword/repository'

export async function processGenerateKeywords(payload: { projectId?: string; websiteId?: string; locale?: string; languageCode?: string; locationCode?: number }) {
  const websiteId = String(payload.websiteId || payload.projectId)
  const locale = payload.locale || 'en-US'
  const website = await websitesRepo.get(websiteId)
  if (!website) { log.warn('[keywords.generate] website not found', { websiteId }); return }
  log.debug('[keywords.generate] start', { websiteId, locale, defaultLocale: website.defaultLocale })

  // 1) Summarize site (from recent crawl pages)
  const crawlPages = await crawlRepo.listRecentPages(websiteId, 120)
  log.debug('[keywords.generate] recent crawl pages', { websiteId, count: crawlPages.length })
  const pages = crawlPages.slice(0, 50).map((p) => ({ url: p.url, title: (p.title as string | undefined) || undefined, text: (p as any).content || '' }))
  const summary = await summarizeSite(pages)
  log.debug('[keywords.generate] site summary', { websiteId, topicClusters: summary.topicClusters?.length ?? 0 })
  try { await websitesRepo.patch(websiteId, { summary: summary.businessSummary || null, status: 'crawled' }) } catch {}

  // 2) Seeds via LLM
  const seedTarget = Math.max(1, Math.min(keywordConfig.seedLimit, 200))
  const seedsLlm = await expandSeeds(summary.topicClusters || [], locale, seedTarget)
  await websitesRepo.patch(websiteId, { seedKeywords: seedsLlm })
  const seedInputs = new Set<string>(seedsLlm.map((s) => s.toLowerCase()))
  const seedBatch = Array.from(seedInputs).slice(0, seedTarget)
  log.debug('[keywords.generate] seeds prepared', { websiteId, llmSeeds: seedsLlm.length, uniqueSeeds: seedBatch.length })
  if (!seedBatch.length) throw new Error('No keyword seeds available after preprocessing')

  // 3) One call: keyword_ideas/live (no SERP info)
  const dfsLanguage = payload.languageCode || languageCodeFromLocale(website?.defaultLocale || payload.locale) || DATAFORSEO_DEFAULT_LANGUAGE_CODE
  const dfsLocation = Number(payload.locationCode || locationCodeFromLocale(website?.defaultLocale || payload.locale) || DATAFORSEO_DEFAULT_LOCATION_CODE)
  const ideasLimit = Math.min(1000, Math.max(1, keywordConfig.keywordLimit))
  const useMockKeywords = String(process.env.MOCK_KEYWORD_GENERATOR || '').trim().toLowerCase() === 'true'
  log.debug('[keywords.generate] requesting keyword ideas', { websiteId, provider: useMockKeywords ? 'mock' : 'dataforseo', dfsLanguage, dfsLocation, limit: ideasLimit, seedCount: seedBatch.length })
  const ideas = useMockKeywords
    ? await mockKeywordGenerator.keywordIdeasDetailed({ keywords: seedBatch, languageCode: dfsLanguage, locationCode: dfsLocation, limit: ideasLimit })
    : await fetchKeywordIdeas({ keywords: seedBatch, languageCode: dfsLanguage, locationCode: dfsLocation, limit: ideasLimit })
  if (!ideas.length) throw new Error('No keyword ideas returned')
  log.debug('[keywords.generate] ideas received', { websiteId, total: ideas.length })

  const providerName = useMockKeywords ? 'mock.keyword_ideas' : 'dataforseo.labs.keyword_ideas'

  // 4) Persist into keywords
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
    const kdScore = Number.isFinite(kd) ? kd : 70
    return { phrase, vol, kdScore, row }
  }).filter((x) => x.phrase)
    .sort((a, b) => (a.kdScore - b.kdScore) || (b.vol - a.vol))
  const includeCount = Math.min(ideasLimit, withMetrics.length)
  const includeSet = new Set(withMetrics.slice(0, includeCount).map((c) => c.phrase.toLowerCase()))

  const filtered = filterSeeds(ideas.map((i) => String(i.keyword || '')), summary)
  log.debug('[keywords.generate] ideas after filter', { websiteId, total: filtered.length })
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
    await keywordsRepo.upsert({
      websiteId,
      phrase,
      phraseNorm: norm(phrase),
      languageCode: dfsLanguage,
      languageName: langName,
      locationCode: dfsLocation,
      locationName,
      provider: providerName,
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
  log.debug('[keywords.generate] persisted keywords', { websiteId, inserted, includeCount: includeSet.size })
  try { await websitesRepo.patch(websiteId, { status: 'keyword_generated' }) } catch {}
  log.debug('[keywords.generate] completed', { websiteId })
}
