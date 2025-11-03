import type { KeywordDiscoveryProvider, DiscoveryResult } from '../../interfaces/keyword-discovery'
import { DATAFORSEO_DEFAULT_LOCATION_CODE } from './geo'
import { mockKeywordGenerator } from '../mock/keyword-generator'
import { dfsClient } from './client'
import { getDevFlags } from '@common/dev/flags'

function getKeywordSource() {
  const flags = getDevFlags()
  if (flags.mocks.keywordExpansion) return mockKeywordGenerator
  return {
    keywordsForSite: ({ target, languageCode, locationCode }: { target: string; languageCode?: string | null; locationCode?: number | null }) =>
      dfsClient.keywordsForSite({ target, languageCode: languageCode || undefined, locationCode: locationCode || undefined }),
    relatedKeywords: ({ keywords, languageCode, locationCode }: { keywords: string[]; languageCode?: string | null; locationCode?: number | null }) =>
      dfsClient.relatedKeywords({ keywords, languageCode: languageCode || undefined, locationCode: locationCode || undefined }),
    keywordIdeas: ({ keywords, languageCode, locationCode }: { keywords: string[]; languageCode?: string | null; locationCode?: number | null }) =>
      dfsClient.keywordIdeas({ keywords, languageCode: languageCode || undefined, locationCode: locationCode || undefined }),
  }
}

export const dataForSeoDiscovery: KeywordDiscoveryProvider = {
  async keywordsForSite({ domain, language, locationCode, limit }) {
    const source = getKeywordSource()
    const items = await source.keywordsForSite({
      target: domain,
      languageCode: language,
      locationCode: Number(locationCode) || DATAFORSEO_DEFAULT_LOCATION_CODE
    })
    const out: DiscoveryResult[] = []
    for (const phrase of items) out.push({ phrase, source: 'site' })
    return typeof limit === 'number' && limit > 0 ? out.slice(0, limit) : out
  },
  async relatedKeywords({ seeds, language, locationCode, limit }) {
    const batch = seeds.slice(0, 20)
    const source = getKeywordSource()
    const items = await source.relatedKeywords({
      keywords: batch,
      languageCode: language,
      locationCode: Number(locationCode) || DATAFORSEO_DEFAULT_LOCATION_CODE
    })
    const seen = new Set<string>()
    const out: DiscoveryResult[] = []
    for (const phrase of items) {
      const k = phrase.toLowerCase()
      if (seen.has(k)) continue
      seen.add(k)
      out.push({ phrase, source: 'related' })
    }
    return typeof limit === 'number' && limit > 0 ? out.slice(0, limit) : out
  },
  async keywordIdeas({ seeds, language, locationCode, limit }) {
    const batch = seeds.slice(0, 10)
    const source = getKeywordSource()
    const items = await source.keywordIdeas({
      keywords: batch,
      languageCode: language,
      locationCode: Number(locationCode) || DATAFORSEO_DEFAULT_LOCATION_CODE
    })
    const seen = new Set<string>()
    const out: DiscoveryResult[] = []
    for (const phrase of items) {
      const k = phrase.toLowerCase()
      if (seen.has(k)) continue
      seen.add(k)
      out.push({ phrase, source: 'ideas' })
    }
    return typeof limit === 'number' && limit > 0 ? out.slice(0, limit) : out
  }
}
