import type { KeywordDiscoveryProvider, DiscoveryResult } from '../../interfaces/keyword-discovery'
import { DATAFORSEO_DEFAULT_LOCATION_CODE } from './geo'
import { mockKeywordGenerator } from '../mock/keyword-generator'

const keywordSource: {
  keywordsForSite(params: { target: string; languageCode?: string | null; locationCode?: number | null }): Promise<string[]>
  relatedKeywords(params: { keywords: string[]; languageCode?: string | null; locationCode?: number | null }): Promise<string[]>
  keywordIdeas(params: { keywords: string[]; languageCode?: string | null; locationCode?: number | null }): Promise<string[]>
} = mockKeywordGenerator

export const dataForSeoDiscovery: KeywordDiscoveryProvider = {
  async keywordsForSite({ domain, language, locationCode, limit }) {
    const items = await keywordSource.keywordsForSite({
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
    const items = await keywordSource.relatedKeywords({
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
    const items = await keywordSource.keywordIdeas({
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
