import type { KeywordDiscoveryProvider, DiscoveryResult } from '../../interfaces/keyword-discovery'
import { dfsClient } from './client'

export const dataForSeoDiscovery: KeywordDiscoveryProvider = {
  async keywordsForSite({ domain, language, locationCode, limit }) {
    const items = await dfsClient.keywordsForSiteLive(domain, language, Number(locationCode) || 2840)
    const out: DiscoveryResult[] = []
    for (const it of items) out.push({ phrase: it.phrase, source: 'site' })
    return typeof limit === 'number' && limit > 0 ? out.slice(0, limit) : out
  },
  async relatedKeywords({ seeds, language, locationCode, limit }) {
    const batch = seeds.slice(0, 20)
    const items = await dfsClient.relatedKeywordsLive(batch, language, Number(locationCode) || 2840)
    const seen = new Set<string>()
    const out: DiscoveryResult[] = []
    for (const it of items) {
      const k = it.phrase.toLowerCase()
      if (seen.has(k)) continue
      seen.add(k)
      out.push({ phrase: it.phrase, source: 'related' })
    }
    return typeof limit === 'number' && limit > 0 ? out.slice(0, limit) : out
  },
  async keywordIdeas({ seeds, language, locationCode, limit }) {
    const batch = seeds.slice(0, 10)
    const items = await dfsClient.keywordIdeasLive(batch, language, Number(locationCode) || 2840)
    const seen = new Set<string>()
    const out: DiscoveryResult[] = []
    for (const it of items) {
      const k = it.phrase.toLowerCase()
      if (seen.has(k)) continue
      seen.add(k)
      out.push({ phrase: it.phrase, source: 'ideas' })
    }
    return typeof limit === 'number' && limit > 0 ? out.slice(0, limit) : out
  }
}

