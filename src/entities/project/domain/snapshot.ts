import type { CrawlPage } from '../../crawl/domain/page'
import type { Keyword } from '../../keyword/domain/keyword'
import type { PlanItem } from '../../plan/domain/plan-item'
import type { ProjectIntegration } from '../../integration/domain/integration'
import type { ProjectDiscoverySummary } from './discovery'

export type ProjectSnapshot = {
  queueDepth?: number
  planItems?: PlanItem[]
  integrations?: ProjectIntegration[]
  crawlPages?: CrawlPage[]
  keywords?: Keyword[]
  latestDiscovery?: {
    startedAt?: string | null
    completedAt?: string | null
    providersUsed: string[]
    summaryJson?: ProjectDiscoverySummary | null
    seedCount?: number | null
    keywordCount?: number | null
    seeds?: string[] | null
    crawlDigest?: Record<string, unknown> | null
  } | null
}
