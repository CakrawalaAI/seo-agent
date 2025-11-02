export type ProjectDiscoverySummary = {
  topicClusters?: string[]
  businessSummary?: string | null
  [key: string]: unknown
}

export type ProjectDiscovery = {
  id: string
  projectId: string
  summaryJson?: ProjectDiscoverySummary | null
  seedJson?: string[] | null
  crawlJson?: Record<string, unknown> | null
  providersUsed?: string[] | null
  seedCount?: number | null
  keywordCount?: number | null
  startedAt?: string | null
  completedAt?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}
