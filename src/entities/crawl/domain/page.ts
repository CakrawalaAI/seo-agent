export type CrawlPageStatus = 'queued' | 'in_progress' | 'completed' | 'failed' | string

export type CrawlPageMeta = {
  title?: string | null
  description?: string | null
  [key: string]: unknown
}

export type CrawlPage = {
  id: string
  websiteId: string
  url: string
  depth?: number | null
  httpStatus?: number | string | null
  status?: CrawlPageStatus | null
  extractedAt?: string | null
  // New canonical fields
  title?: string | null
  content?: string | null
  summary?: string | null
  // Legacy/optional fields (kept for compatibility)
  metaJson?: CrawlPageMeta | null
  headingsJson?: unknown | null
  linksJson?: unknown | null
  contentBlobUrl?: string | null
  contentText?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}
