export type MonthlyMetric = {
  asOfMonth: string // YYYY-MM
  searchVolume?: number
  cpc?: number
  competition?: number
  difficulty?: number
  history?: Array<{ month: string; searchVolume: number }>
}

export type CanonRef = { phrase: string; language: string }

export interface KeywordMetricsProvider {
  ensureMonthly(
    canon: CanonRef,
    locationCode: number,
    month: string,
    opts?: { force?: boolean }
  ): Promise<MonthlyMetric>
  /**
   * Cheap scoring across many candidates. Returns difficulty for up to 1000 keywords.
   */
  bulkDifficulty(
    phrases: string[],
    language: string,
    locationCode: number
  ): Promise<Array<{ phrase: string; difficulty?: number }>>

  /**
   * Rich metrics for top N (<=200). Returns overview per phrase.
   */
  overviewBatch(
    phrases: string[],
    language: string,
    locationCode: number
  ): Promise<Map<string, MonthlyMetric & { competition?: number }>>
}
