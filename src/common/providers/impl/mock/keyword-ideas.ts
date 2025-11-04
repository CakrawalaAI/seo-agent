import type { KeywordIdeasProvider, KeywordIdeaRecord } from '../../interfaces/keyword-ideas'
import { mockKeywordGenerator } from './keyword-generator'
import { log } from '@src/common/logger'

export const mockKeywordIdeasProvider: KeywordIdeasProvider = {
  async keywordIdeas({ seeds, limit }) {
    log.debug('[mock.keywordIdeasProvider] keywordIdeas request', { seeds, limit: limit ?? null })
    const detailed = await mockKeywordGenerator.keywordIdeasDetailed({ keywords: seeds, limit })
    log.debug('[mock.keywordIdeasProvider] keywordIdeas response', { total: detailed.length, keywords: detailed.map((item) => item.keyword) })
    return detailed.map<KeywordIdeaRecord>((item) => ({
      keyword: item.keyword,
      keyword_info: item.keyword_info,
      keyword_properties: item.keyword_properties,
      impressions_info: item.impressions_info
    }))
  }
}
