import { summarizeSite, expandSeeds } from '@common/providers/llm-helpers'
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
// Realtime broadcast removed; dashboard polls snapshot
import { getKeywordRegenerateConfig, setKeywordRegenerateConfig } from '@entities/keyword/config'

type GenerateKeywordPayload = {
  projectId?: string
  websiteId?: string
  locale?: string
  languageCode?: string
  locationCode?: number
  mode?: 'regenerate' | string
  requestId?: string
}

export async function processGenerateKeywords(payload: GenerateKeywordPayload) {
  const websiteId = String(payload.websiteId || payload.projectId)
  const locale = payload.locale || 'en-US'
  const mode = payload?.mode === 'regenerate' ? 'regenerate' : 'standard'
  const requestId = typeof payload?.requestId === 'string' ? String(payload.requestId) : null
  const website = await websitesRepo.get(websiteId)
  if (!website) { log.warn('[keywords.generate] website not found', { websiteId }); return }
  log.debug('[keywords.generate] start', { websiteId, locale, defaultLocale: website.defaultLocale, mode })

  const regenConfigBefore = mode === 'regenerate' ? (await getKeywordRegenerateConfig(websiteId)) || null : null
  const startedAtIso = new Date().toISOString()

  const seedTarget = Math.max(1, Math.min(keywordConfig.seedLimit, 200))
  const dfsLanguage = payload.languageCode || languageCodeFromLocale(website.defaultLocale || locale) || DATAFORSEO_DEFAULT_LANGUAGE_CODE
  const dfsLocation = Number(payload.locationCode || locationCodeFromLocale(website.defaultLocale || locale) || DATAFORSEO_DEFAULT_LOCATION_CODE)
  const ideasLimit = Math.min(1000, Math.max(1, keywordConfig.keywordLimit))
  const useMockKeywords = String(process.env.MOCK_KEYWORD_GENERATOR || '').trim().toLowerCase() === 'true'
  const providerName = useMockKeywords ? 'mock.keyword_ideas' : 'dataforseo.labs.keyword_ideas'
  const langName = languageNameFromCode(dfsLanguage)
  const locationName = locationNameFromCode(dfsLocation)

  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')

  let summary: { businessSummary?: string; topicClusters?: string[] } = { businessSummary: website.summary || '', topicClusters: [] }
  let seedBatch: string[] = []

  try {
    if (mode === 'regenerate') {
      const storedSeeds = Array.isArray(website.seedKeywords) ? website.seedKeywords : []
      const deduped: string[] = []
      const seen = new Set<string>()
      for (const raw of storedSeeds) {
        const phrase = String(raw || '').trim()
        if (!phrase) continue
        const key = norm(phrase)
        if (seen.has(key)) continue
        seen.add(key)
        deduped.push(phrase)
      }
      if (!deduped.length) throw new Error('No stored seed keywords to regenerate')
      seedBatch = deduped.slice(0, seedTarget)
      try { await websitesRepo.patch(websiteId, { seedKeywords: seedBatch }) } catch {}
      log.debug('[keywords.generate] regenerate seeds prepared', { websiteId, stored: storedSeeds.length, uniqueSeeds: seedBatch.length })
    } else {
      const crawlPages = await crawlRepo.listRecentPages(websiteId, 120)
      log.debug('[keywords.generate] recent crawl pages', { websiteId, count: crawlPages.length })
      const pages = crawlPages.slice(0, 50).map((p) => ({ url: p.url, title: (p.title as string | undefined) || undefined, text: (p as any).content || '' }))
      summary = await summarizeSite(pages)
      log.debug('[keywords.generate] site summary', { websiteId, topicClusters: summary.topicClusters?.length ?? 0 })
      // Do not overwrite an existing crawl-derived summary; only set when empty
      try {
        if (!website.summary || !String(website.summary).trim()) {
          await websitesRepo.patch(websiteId, { summary: summary.businessSummary || null, status: 'crawled' })
        }
      } catch {}
      const seedsLlm = await expandSeeds(summary.topicClusters || [], locale, seedTarget)
      await websitesRepo.patch(websiteId, { seedKeywords: seedsLlm })
      const seedInputs = new Set<string>()
      for (const seed of seedsLlm) {
        const phrase = String(seed || '').trim()
        if (!phrase) continue
        const key = norm(phrase)
        if (seedInputs.has(key)) continue
        seedInputs.add(key)
        seedBatch.push(phrase)
        if (seedBatch.length >= seedTarget) break
      }
      log.debug('[keywords.generate] seeds prepared', { websiteId, llmSeeds: seedsLlm.length, uniqueSeeds: seedBatch.length })
      if (!seedBatch.length) throw new Error('No keyword seeds available after preprocessing')
    }

    log.debug('[keywords.generate] requesting keyword ideas', { websiteId, provider: useMockKeywords ? 'mock' : 'dataforseo', dfsLanguage, dfsLocation, limit: ideasLimit, seedCount: seedBatch.length })
    const ideas = useMockKeywords
      ? await mockKeywordGenerator.keywordIdeasDetailed({ keywords: seedBatch, languageCode: dfsLanguage, locationCode: dfsLocation, limit: ideasLimit })
      : await fetchKeywordIdeas({ keywords: seedBatch, languageCode: dfsLanguage, locationCode: dfsLocation, limit: ideasLimit })
    if (!ideas.length) throw new Error('No keyword ideas returned')
    log.debug('[keywords.generate] ideas received', { websiteId, total: ideas.length })

    const filtered = filterSeeds(ideas.map((i) => String(i.keyword || '')), summary)
    log.debug('[keywords.generate] ideas after filter', { websiteId, total: filtered.length, mode })

    const metricsMap = new Map<string, { phrase: string; metricsJson: { searchVolume: number | null; difficulty: number | null } }>()
    for (const row of ideas) {
      const phrase = String(row.keyword || '').trim()
      if (!phrase) continue
      const info = row.keyword_info || {}
      const props = row.keyword_properties || {}
      const searchVolume = typeof info?.search_volume === 'number' ? Number(info.search_volume) : null
      const difficulty = typeof props?.keyword_difficulty === 'number' ? Number(props.keyword_difficulty) : null
      metricsMap.set(norm(phrase), {
        phrase,
        metricsJson: { searchVolume, difficulty }
      })
    }

    const autoIncludeSet = keywordsRepo.selectTopForAutoActive(
      filtered
        .map((phrase) => {
          const key = norm(phrase)
          const metrics = metricsMap.get(key)
          return metrics ? { phrase: metrics.phrase, metricsJson: metrics.metricsJson } : { phrase, metricsJson: { searchVolume: null, difficulty: null } }
        })
    )

    if (mode === 'regenerate') {
      log.debug('[keywords.generate] clearing existing keywords before regenerate', { websiteId })
      await keywordsRepo.removeAllForWebsite(websiteId)
    }

    let inserted = 0
    const nowIso = new Date().toISOString()
    const limit = ideasLimit
    for (const phrase of filtered) {
      if (!phrase || inserted >= limit) break
      const row = ideas.find((i) => String(i.keyword || '').trim().toLowerCase() === phrase.trim().toLowerCase())
      if (!row) continue
      const info = row.keyword_info || {}
      const props = row.keyword_properties || {}
      const monthly = Array.isArray(info?.monthly_searches)
        ? info.monthly_searches
            .map((m: any) => ({ month: `${m?.year ?? ''}-${String(m?.month ?? 1).padStart(2, '0')}`, searchVolume: Number(m?.search_volume ?? 0) }))
            .filter((x: any) => x.month && Number.isFinite(x.searchVolume))
        : null
      await keywordsRepo.upsert({
        websiteId,
        phrase: norm(phrase),
        languageCode: dfsLanguage,
        languageName: langName,
        locationCode: dfsLocation,
        locationName,
        provider: providerName,
        active: autoIncludeSet.has(norm(phrase)),
        searchVolume: Number(info?.search_volume ?? 0) || 0,
        cpc: typeof info?.cpc === 'number' ? Number(info.cpc) : null,
        competition: typeof info?.competition === 'number' ? Number(info.competition) : null,
        difficulty: typeof props?.keyword_difficulty === 'number' ? Number(props.keyword_difficulty) : null,
        vol12m: monthly,
        impressions: row.impressions_info || null,
        raw: row as any,
        metricsAsOf: nowIso
      })
      inserted++
    }
    log.debug('[keywords.generate] persisted keywords', { websiteId, inserted, activeCount: autoIncludeSet.size, mode })

    try { await websitesRepo.patch(websiteId, { status: 'keyword_generated' }) } catch {}
    const totalKeywords = await keywordsRepo.count(websiteId)
    log.debug('[keywords.generate] completed', { websiteId, mode, totalKeywords })

    if (mode === 'regenerate') {
      await setKeywordRegenerateConfig(websiteId, {
        lastRequestedAt: regenConfigBefore?.lastRequestedAt ?? startedAtIso,
        lastCompletedAt: new Date().toISOString(),
        lastFailedAt: null,
        lastStatus: 'completed',
        lastJobId: regenConfigBefore?.lastJobId ?? null,
        lastRequestId: requestId ?? regenConfigBefore?.lastRequestId ?? null
      })
    }
  } catch (error) {
    if (mode === 'regenerate') {
      try {
        await setKeywordRegenerateConfig(websiteId, {
          lastRequestedAt: regenConfigBefore?.lastRequestedAt ?? startedAtIso,
          lastCompletedAt: regenConfigBefore?.lastCompletedAt ?? null,
          lastFailedAt: new Date().toISOString(),
          lastStatus: 'failed',
          lastJobId: regenConfigBefore?.lastJobId ?? null,
          lastRequestId: requestId ?? regenConfigBefore?.lastRequestId ?? null
        })
      } catch (cfgError) {
        log.warn('[keywords.generate] failed to persist regenerate failure state', {
          websiteId,
          error: cfgError instanceof Error ? cfgError.message : String(cfgError)
        })
      }
    }
    throw error
  }
}
