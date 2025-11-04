export type KeywordIdeaResult = { phrase: string; source: 'ideas' }

export type KeywordIdeaRecord = {
  keyword: string
  keyword_info: Record<string, unknown> | null
  keyword_properties: Record<string, unknown> | null
  impressions_info: Record<string, unknown> | null
}

export interface KeywordIdeasProvider {
  keywordIdeas(input: {
    seeds: string[]
    siteUrl?: string | null
    language: string
    locationCode: number
    limit?: number
  }): Promise<KeywordIdeaRecord[]>
}
