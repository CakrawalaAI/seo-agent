export type CrawlPageStatus = 'queued' | 'in_progress' | 'completed' | 'failed' | string

export type CrawlPageMeta = {
  title?: string | null
  description?: string | null
  [key: string]: unknown
}

export type CrawlPage = {
  id: string
  projectId: string
  url: string
  depth?: number | null
  httpStatus?: number | string | null
  status?: CrawlPageStatus | null
  extractedAt?: string | null
  metaJson?: CrawlPageMeta | null
  headingsJson?: unknown | null
  linksJson?: unknown | null
  contentBlobUrl?: string | null
  contentText?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}
