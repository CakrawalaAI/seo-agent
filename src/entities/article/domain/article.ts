export type ArticleStatus = 'draft' | 'published' | 'queued' | string

export type ArticleOutlineSection = {
  heading: string
  subpoints?: string[]
}

export type Article = {
  id: string
  projectId: string
  planItemId?: string | null
  keywordId?: string | null
  plannedDate?: string | null
  title?: string | null
  language?: string | null
  tone?: string | null
  status?: ArticleStatus | null
  outlineJson?: ArticleOutlineSection[] | null
  bodyHtml?: string | null
  generationDate?: string | null
  publicationDate?: string | null
  cmsExternalId?: string | null
  url?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}

export type PublishArticleResult = {
  jobId?: string
}
