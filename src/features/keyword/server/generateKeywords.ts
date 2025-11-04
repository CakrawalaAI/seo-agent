import { getKeywordIdeasProvider } from '@common/providers/registry'
import type { KeywordIdeaResult } from '@common/providers/interfaces/keyword-ideas'
import { log } from '@src/common/logger'

type GenerateKeywordsInput = {
  siteUrl?: string | null
  seeds: string[]
  language: string
  locationCode: number
  ideasLimit?: number
}

export async function generateKeywords(input: GenerateKeywordsInput): Promise<KeywordIdeaResult[]> {
  const provider = getKeywordIdeasProvider()
  log.debug('[keywords.generate.feature] raw input', {
    seeds: input.seeds,
    siteUrl: input.siteUrl || null,
    language: input.language,
    locationCode: input.locationCode,
    ideasLimit: input.ideasLimit ?? null
  })
  const uniqueSeeds = Array.from(new Set(input.seeds.map((s) => String(s || '').trim()).filter(Boolean)))
  log.debug('[keywords.generate.feature] unique seeds derived', { uniqueSeeds })
  let fallbackSeed: string | undefined
  if (!uniqueSeeds.length && input.siteUrl) {
    try {
      const url = new URL(input.siteUrl)
      fallbackSeed = url.hostname.replace(/^www\./, '')
    } catch {
      fallbackSeed = undefined
    }
  }
  const seeds = uniqueSeeds.length ? uniqueSeeds.slice(0, input.ideasLimit ?? 1000) : [fallbackSeed || 'interview']
  log.debug('[keywords.generate.feature] seeds selected', { seeds, fallbackSeed: fallbackSeed || null })

  const ideas = await provider.keywordIdeas({
    seeds,
    siteUrl: input.siteUrl,
    language: input.language,
    locationCode: input.locationCode,
    limit: input.ideasLimit ?? 1000
  })
  const providerLabel = typeof provider.keywordIdeas === 'function' && provider.keywordIdeas.name ? provider.keywordIdeas.name : 'keywordIdeas'
  log.debug('[keywords.generate.feature] ideas fetched', {
    provider: providerLabel,
    seedCount: seeds.length,
    ideaCount: ideas.length,
    keywords: ideas.map((idea) => idea.keyword)
  })

  if (!ideas.length) {
    throw new Error(
      `DataForSEO returned no keywords (siteUrl=${input.siteUrl ? new URL(input.siteUrl).hostname : 'none'}, seeds=${seeds.length}, language=${input.language}, location=${input.locationCode})`
    )
  }

  const seen = new Set<string>()
  const results: KeywordIdeaResult[] = []
  for (const item of ideas) {
    const phrase = String(item.keyword || '').trim()
    if (!phrase) continue
    const key = phrase.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    log.debug('[keywords.generate.feature] keyword accepted', { keyword: phrase })
    results.push({ phrase, source: 'ideas' })
  }
  log.debug('[keywords.generate.feature] keyword list finalized', { total: results.length })
  return results
}
