export type ArticleStatus = 'draft' | 'generating' | 'ready' | 'published' | 'failed' | string

export type ArticleOutlineSection = {
  heading: string
  subpoints?: string[]
}

export type Article = {
  id: string
  projectId: string
  keywordId?: string | null
  plannedDate?: string | null
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
