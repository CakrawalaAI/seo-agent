import type { KeywordMetricsProvider, MonthlyMetric } from '../../interfaces/keyword-metrics'
import { dfsClient } from './client'
import { DATAFORSEO_DEFAULT_LOCATION_CODE } from './geo'

export const dataForSeoMetrics: KeywordMetricsProvider = {
  async ensureMonthly(canon, locationCode, month, opts) {
    const map = await dfsClient.keywordOverview({
      keywords: [canon.phrase],
      languageCode: canon.language,
      locationCode: Number(locationCode) || DATAFORSEO_DEFAULT_LOCATION_CODE
    })
    const item = map.get(canon.phrase.toLowerCase()) as any
    const monthly = Array.isArray(item?.monthly_searches) ? item.monthly_searches : []
    const history: MonthlyMetric['history'] = monthly
      .map((m: any) => ({ month: `${m?.year ?? ''}-${String(m?.month ?? 1).padStart(2, '0')}`, searchVolume: Number(m?.search_volume ?? 0) }))
      .filter((x: any) => x.month && Number.isFinite(x.searchVolume))
    const out: MonthlyMetric = {
      asOfMonth: month,
      searchVolume: typeof item?.search_volume === 'number' ? item.search_volume : undefined,
      cpc: typeof item?.cpc === 'number' ? item.cpc : undefined,
      competition: typeof item?.competition === 'number' ? item.competition : undefined,
      difficulty: typeof item?.keyword_difficulty === 'number' ? item.keyword_difficulty : undefined,
      history
    }
    return out
  },
  async bulkDifficulty(phrases, language, locationCode) {
    try {
      const map = await dfsClient.bulkKeywordDifficulty({
        keywords: phrases,
        languageCode: language,
        locationCode: Number(locationCode) || DATAFORSEO_DEFAULT_LOCATION_CODE
      })
      return phrases.map((phrase) => ({ phrase, difficulty: map.get(phrase.toLowerCase()) }))
    } catch {
      return phrases.map((p) => ({ phrase: p, difficulty: undefined }))
    }
  },
  async overviewBatch(phrases, language, locationCode) {
    try {
      const map = await dfsClient.keywordOverview({
        keywords: phrases,
        languageCode: language,
        locationCode: Number(locationCode) || DATAFORSEO_DEFAULT_LOCATION_CODE
      })
      const out = new Map<string, MonthlyMetric & { competition?: number }>()
      for (const [k, v] of map.entries()) {
        const history: MonthlyMetric['history'] = Array.isArray(v?.monthly_searches)
          ? v.monthly_searches.map((m: any) => ({ month: `${m?.year ?? ''}-${String(m?.month ?? 1).padStart(2, '0')}`, searchVolume: Number(m?.search_volume ?? 0) }))
          : []
        out.set(k, {
          asOfMonth: `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, '0')}`,
          searchVolume: typeof v?.search_volume === 'number' ? v.search_volume : undefined,
          cpc: typeof v?.cpc === 'number' ? v.cpc : undefined,
          difficulty: typeof v?.keyword_difficulty === 'number' ? v.keyword_difficulty : undefined,
          competition: typeof v?.competition === 'number' ? v.competition : undefined,
          history
        })
      }
      return out
    } catch {
      return new Map()
    }
  }
}
