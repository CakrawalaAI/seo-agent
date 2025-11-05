export type WebsiteStatus = 'crawled' | 'keyword_generated' | 'articles_scheduled' | 'crawling' | 'error'

export type Website = {
  id: string
  orgId: string
  url: string
  defaultLocale: string
  summary?: string | null
  seedKeywords?: string[] | null
  settings?: {
    allowYoutube?: boolean
    maxImages?: number
    articleGeneration?: {
      features?: {
        serp?: boolean
        youtube?: boolean
        imageUnsplash?: boolean
        imageAi?: boolean
        research?: boolean
        attachments?: boolean
      }
    }
  } | null
  status: WebsiteStatus
  createdAt?: string | null
  updatedAt?: string | null
}
