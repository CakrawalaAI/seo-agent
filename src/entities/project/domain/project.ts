export type ProjectStatus = 'draft' | 'active' | 'inactive'

export type Project = {
  id: string
  name: string
  /**
   * BCP 47 locale string, e.g. en-US.
  */
  defaultLocale: string
  siteUrl?: string | null
  autoPublishPolicy?: string | null
  orgId?: string | null
  status?: ProjectStatus
  crawlMaxDepth?: number | null
  crawlBudgetPages?: number | null
  bufferDays?: number | null
  serpDevice?: 'desktop' | 'mobile' | null
  serpLocationCode?: number | null
  metricsLocationCode?: number | null
  createdAt?: string
  updatedAt?: string
}
