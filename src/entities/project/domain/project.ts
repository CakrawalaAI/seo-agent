export type ProjectStatus = 'draft' | 'crawling' | 'crawled' | 'keywords_ready' | 'active' | 'error'

export type Project = {
  id: string
  name: string
  orgId: string
  siteUrl?: string | null
  defaultLocale: string
  status: ProjectStatus
  autoPublishPolicy?: 'buffered' | 'immediate' | 'manual' | string | null
  bufferDays?: number | null
  serpDevice?: 'desktop' | 'mobile' | null
  serpLocationCode?: number | null
  metricsLocationCode?: number | null
  dfsLanguageCode?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}
