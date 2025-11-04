import type { KeywordIdeasProvider, KeywordIdeaRecord } from '../../interfaces/keyword-ideas'
import { DATAFORSEO_DEFAULT_LOCATION_CODE, DATAFORSEO_DEFAULT_LANGUAGE_CODE } from './geo'
import { keywordIdeas as fetchKeywordIdeas } from './keyword-ideas'
import { log } from '@src/common/logger'

export const dataForSeoKeywordIdeasProvider: KeywordIdeasProvider = {
  async keywordIdeas({ seeds, language, locationCode, limit }) {
    const keywords = seeds && seeds.length ? seeds : ['interview']
    log.debug('[dfs.keywordIdeasProvider] keywordIdeas request', {
      seeds,
      normalizedSeeds: keywords,
      language: language || DATAFORSEO_DEFAULT_LANGUAGE_CODE,
      locationCode: Number(locationCode) || DATAFORSEO_DEFAULT_LOCATION_CODE,
      limit: limit ?? null
    })
    const items = await fetchKeywordIdeas({
      keywords,
      locationCode: Number(locationCode) || DATAFORSEO_DEFAULT_LOCATION_CODE,
      languageCode: language || DATAFORSEO_DEFAULT_LANGUAGE_CODE,
      limit
    })
    log.debug('[dfs.keywordIdeasProvider] keywordIdeas response', {
      seeds: keywords,
      total: items.length,
      keywords: items.map((item) => item.keyword)
    })
    return items.map<KeywordIdeaRecord>((item) => ({
      keyword: item.keyword,
      keyword_info: item.keyword_info,
      keyword_properties: item.keyword_properties,
      impressions_info: item.impressions_info
    }))
  }
}
