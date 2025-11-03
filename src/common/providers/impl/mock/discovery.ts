import type { KeywordDiscoveryProvider, DiscoveryResult } from '../../interfaces/keyword-discovery'

const difficultyCycle: Array<'low' | 'medium' | 'high'> = ['low', 'medium', 'high']

function generateMockKeywords(count = 50, source: DiscoveryResult['source']): DiscoveryResult[] {
  const items: DiscoveryResult[] = []
  for (let i = 0; i < count; i++) {
    const index = i + 1
    items.push({
      phrase: `mock keyword ${index}`,
      source
    })
  }
  return items
}

export const mockDiscoveryProvider: KeywordDiscoveryProvider = {
  async keywordsForSite({ limit }) {
    const count = typeof limit === 'number' && limit > 0 ? limit : 50
    return generateMockKeywords(count, 'site')
  },
  async relatedKeywords({ limit }) {
    const count = typeof limit === 'number' && limit > 0 ? limit : 50
    return generateMockKeywords(count, 'related')
  },
  async keywordIdeas({ limit }) {
    const count = typeof limit === 'number' && limit > 0 ? limit : 50
    return generateMockKeywords(count, 'ideas')
  }
}

export function mockKeywordMetrics(index: number) {
  const volume = 1000 + index * 100
  const difficulty = (() => {
    const step = difficultyCycle[index % difficultyCycle.length]
    if (step === 'low') return 20
    if (step === 'medium') return 45
    return 70
  })()
  return {
    searchVolume: volume,
    difficulty,
    cpc: 1.5,
    competition: 0.5,
    rankability: Math.max(0, 100 - difficulty),
    asOf: new Date().toISOString()
  }
}
