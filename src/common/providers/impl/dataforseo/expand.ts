import type { KeywordExpandProvider, ExpandedKeyword } from '../../interfaces/keyword-expand'
import { dfsClient } from './client'
import { DATAFORSEO_DEFAULT_LOCATION_CODE } from './geo'

export const dataForSeoExpand: KeywordExpandProvider = {
  async expand({ phrases, language, locationCode, limit }) {
    const batch = phrases.slice(0, 10)
    const useSuggestions = String(process.env.SEOA_DFS_SUGGESTIONS_FIRST || '1') !== '0'
    const out: ExpandedKeyword[] = []
    if (useSuggestions) {
      // call suggestions for the first seed only (cheaper), then fall back to keywords_for_keywords for more breadth
      try {
        const first = batch[0]
        if (first) {
          const items = await dfsClient.keywordSuggestions({
            keyword: first,
            languageCode: language || undefined,
            locationCode: Number(locationCode) || DATAFORSEO_DEFAULT_LOCATION_CODE
          })
          for (const phrase of items) out.push({ phrase, source: 'dataforseo' })
        }
      } catch {}
    }
    try {
      const items2 = await dfsClient.keywordsForKeywords({
        keywords: batch,
        languageCode: language || undefined,
        locationCode: Number(locationCode) || DATAFORSEO_DEFAULT_LOCATION_CODE
      })
      for (const phrase of items2) out.push({ phrase, source: 'dataforseo' })
    } catch {}
    const unique: ExpandedKeyword[] = []
    const seen = new Set<string>()
    for (const k of out) {
      const key = k.phrase.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      unique.push(k)
    }
    return (typeof limit === 'number' && limit > 0) ? unique.slice(0, limit) : unique
  }
}
