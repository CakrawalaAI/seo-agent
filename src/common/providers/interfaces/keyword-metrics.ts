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
}

