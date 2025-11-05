export type ArticleStatus = 'queued' | 'scheduled' | 'published' | 'unpublished' | string

export type ArticleOutlineSection = {
  heading: string
  subpoints?: string[]
}

export type ArticleFeatureFlags = {
  serp: boolean
  youtube: boolean
  imageUnsplash: boolean
  imageAi: boolean
  research: boolean
  attachments: boolean
}

export type ArticleGenerationContext = {
  websiteSummary?: string
  serpDump?: string
  competitorDump?: string
  citations: Array<{ title?: string; url: string; snippet?: string }>
  youtube: Array<{ title?: string; url: string }>
  images: Array<{ src: string; alt?: string; caption?: string }>
  internalLinks: Array<{ anchor?: string; url: string }>
  features: ArticleFeatureFlags
}

export type ArticleGenerationPayload = {
  version: 1
  articleId: string
  websiteId?: string | null
  title?: string | null
  targetKeyword?: string | null
  locale?: string | null
  outline: ArticleOutlineSection[]
  bodyHtml: string
  wordCount: number
  readingMinutes: number
  generatedAt: string
  context: ArticleGenerationContext
}

export type ArticleAttachment = {
  id: string
  articleId: string
  type: 'image' | 'youtube' | 'file'
  url: string
  caption?: string | null
  storageKey?: string | null
  order?: number | null
  createdAt?: string | null
}

export type Article = {
  id: string
  websiteId: string
  keywordId?: string | null
  scheduledDate?: string | null
  title?: string | null
  targetKeyword?: string | null
  language?: string | null
  tone?: string | null
  status?: ArticleStatus | null
  outlineJson?: ArticleOutlineSection[] | null
  bodyHtml?: string | null
  generationDate?: string | null
  publishDate?: string | null
  cmsExternalId?: string | null
  url?: string | null
  payloadJson?: ArticleGenerationPayload | null
  createdAt?: string | null
  updatedAt?: string | null
}

export type PublishArticleResult = {
  jobId?: string
}
