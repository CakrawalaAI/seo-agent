export type KeywordMetrics = {
  searchVolume?: number | null
  difficulty?: number | null
  cpc?: number | null
  asOf?: string | null
}

export type Keyword = {
  id: string
  projectId: string
  phrase: string
  status?: string | null
  starred?: boolean | null
  opportunity?: number | null
  metricsJson?: KeywordMetrics | null
  createdAt?: string | null
  updatedAt?: string | null
}
