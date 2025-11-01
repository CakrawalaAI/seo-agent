import type { KeywordMetricsProvider, MonthlyMetric } from '../../interfaces/keyword-metrics'
import { config } from '@common/config'
import { dfsClient } from './client'

// Map language like 'en-US' -> 'English' when DFS needs a language_name.
function languageName(lang: string) {
  if (!lang) return 'English'
  const code = lang.toLowerCase()
  if (code.startsWith('en')) return 'English'
  if (code.startsWith('ja')) return 'Japanese'
  if (code.startsWith('es')) return 'Spanish'
  if (code.startsWith('fr')) return 'French'
  if (code.startsWith('de')) return 'German'
  return 'English'
}

export const dataForSeoMetrics: KeywordMetricsProvider = {
  async ensureMonthly(canon, locationCode, month, opts) {
    const allowStubs = Boolean(config.providers.allowStubs)
    const item = (await dfsClient.keywordOverviewLive(canon.phrase, canon.language, Number(locationCode) || 2840)) as any
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
      const items = await dfsClient.bulkKeywordDifficultyLive(phrases, language, Number(locationCode) || 2840)
      return items
    } catch {
      return phrases.map((p) => ({ phrase: p, difficulty: undefined }))
    }
  },
  async overviewBatch(phrases, language, locationCode) {
    try {
      const map = await dfsClient.keywordOverviewBatchLive(phrases, language, Number(locationCode) || 2840)
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
