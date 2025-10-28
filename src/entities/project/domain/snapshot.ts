import type { CrawlPage } from '../../crawl/domain/page'
import type { Keyword } from '../../keyword/domain/keyword'
import type { PlanItem } from '../../plan/domain/plan-item'
import type { ProjectIntegration } from '../../integration/domain/integration'

export type ProjectDiscoverySummary = {
  topicClusters?: string[]
  businessSummary?: string | null
  [key: string]: unknown
}

export type ProjectSnapshot = {
  queueDepth?: number
  planItems?: PlanItem[]
  integrations?: ProjectIntegration[]
  crawlPages?: CrawlPage[]
  keywords?: Keyword[]
  latestDiscovery?: {
    startedAt?: string | null
    providersUsed: string[]
    summaryJson?: ProjectDiscoverySummary | null
  } | null
}
