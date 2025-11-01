export type DiscoveryResult = { phrase: string; source: 'site' | 'related' | 'ideas' }

export interface KeywordDiscoveryProvider {
  keywordsForSite(input: {
    domain: string
    language: string
    locationCode: number
    limit?: number
  }): Promise<DiscoveryResult[]>

  relatedKeywords(input: {
    seeds: string[]
    language: string
    locationCode: number
    limit?: number
  }): Promise<DiscoveryResult[]>

  keywordIdeas(input: {
    seeds: string[]
    language: string
    locationCode: number
    limit?: number
  }): Promise<DiscoveryResult[]>
}

