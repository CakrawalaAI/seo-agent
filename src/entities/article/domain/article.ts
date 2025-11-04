export type ArticleStatus = 'queued' | 'scheduled' | 'published' | string

export type ArticleOutlineSection = {
  heading: string
  subpoints?: string[]
}

export type Article = {
  id: string
  websiteId: string
  keywordId?: string | null
  scheduledDate?: string | null
  title?: string | null
  language?: string | null
  tone?: string | null
  status?: ArticleStatus | null
  outlineJson?: ArticleOutlineSection[] | null
  bodyHtml?: string | null
  generationDate?: string | null
  publishDate?: string | null
  cmsExternalId?: string | null
  url?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}

export type PublishArticleResult = {
  jobId?: string
}
