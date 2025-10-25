import { randomUUID } from 'node:crypto'

type KeywordMetrics = {
  keyword: string
  searchVolume: number | null
  cpc: number | null
  competition: number | null
  difficulty: number | null
  trend12mo?: number[]
}

export type DataForSEOClientOptions = {
  baseUrl?: string
  login?: string
  password?: string
  batchSize?: number
  fetchImpl?: typeof fetch
}

export type DataForSEOMetricsResponse = KeywordMetrics

const DEFAULT_BASE_URL = 'https://api.dataforseo.com'
const DEFAULT_BATCH_SIZE = 50

const normalizeMonthlyTrend = (monthlySearches: Array<{ year?: number; month?: number; search_volume?: number }> | undefined) => {
  if (!monthlySearches) return undefined
  const ordered = monthlySearches
    .filter((item) => typeof item.search_volume === 'number')
    .sort((a, b) => {
      if ((a.year ?? 0) === (b.year ?? 0)) return (a.month ?? 0) - (b.month ?? 0)
      return (a.year ?? 0) - (b.year ?? 0)
    })
  return ordered.map((item) => item.search_volume ?? 0)
}

const parseTaskResult = (task: any): KeywordMetrics[] => {
  const results = task?.result ?? []
  const metrics: KeywordMetrics[] = []
  for (const result of results) {
    const data = result.keyword_data ?? result
    const keyword = data?.keyword ?? result?.keyword ?? ''
    if (!keyword) continue
    const searchVolume = data?.search_volume ?? data?.metrics?.search_volume ?? null
    const cpc = data?.cpc ?? data?.metrics?.cpc ?? null
    const competition = data?.competition ?? data?.metrics?.competition ?? null
    const difficulty = data?.keyword_difficulty ?? data?.metrics?.keyword_difficulty ?? null
    const trend12mo = normalizeMonthlyTrend(data?.monthly_searches ?? data?.metrics?.monthly_searches)
    metrics.push({ keyword, searchVolume, cpc, competition, difficulty, trend12mo })
  }
  return metrics
}

export class DataForSEOClient {
  private readonly fetch: typeof fetch

  constructor(private readonly options: DataForSEOClientOptions = {}) {
    this.fetch = options.fetchImpl ?? fetch
  }

  isConfigured(): boolean {
    return Boolean(this.options.login && this.options.password)
  }

  private async request<T>(endpoint: string, payload: Record<string, unknown>): Promise<T> {
    if (!this.isConfigured()) {
      throw new Error('DataForSEO credentials are not configured')
    }
    const url = new URL(endpoint, this.options.baseUrl ?? DEFAULT_BASE_URL)
    const auth = Buffer.from(`${this.options.login}:${this.options.password}`).toString('base64')
    const response = await this.fetch(url.toString(), {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })
    if (!response.ok) {
      const text = await response.text()
      throw new Error(`DataForSEO request failed: ${response.status} ${text}`)
    }
    return (await response.json()) as T
  }

  async fetchKeywordMetrics(
    keywords: string[],
    locale: string,
    location?: string,
  ): Promise<Map<string, DataForSEOMetricsResponse>> {
    if (keywords.length === 0) return new Map()
    const batchSize = this.options.batchSize ?? DEFAULT_BATCH_SIZE
    const chunks: string[][] = []
    for (let i = 0; i < keywords.length; i += batchSize) {
      chunks.push(keywords.slice(i, i + batchSize))
    }

    const results = new Map<string, DataForSEOMetricsResponse>()

    for (const chunk of chunks) {
      const payload = {
        data: chunk.map((keyword) => ({
          keyword,
          language_name: locale,
          location_name: location ?? 'United States',
          search_partners: false,
          se_id: randomUUID()
        }))
      }
      const response: any = await this.request('/v3/keywords_data/google/search_volume/live', payload)
      const tasks = response?.tasks ?? []
      for (const task of tasks) {
        const metrics = parseTaskResult(task)
        for (const metric of metrics) {
          results.set(metric.keyword.toLowerCase(), metric)
        }
      }
    }

    return results
  }
}
