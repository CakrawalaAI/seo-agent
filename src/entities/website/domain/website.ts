export type WebsiteStatus = 'crawled' | 'keyword_generated' | 'articles_scheduled' | 'error'

export type Website = {
  id: string
  orgId: string
  url: string
  defaultLocale: string
  summary?: string | null
  settings?: {
    allowYoutube?: boolean
    maxImages?: number
  } | null
  status: WebsiteStatus
  createdAt?: string | null
  updatedAt?: string | null
}
