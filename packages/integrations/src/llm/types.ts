export type CrawlPageSnapshot = {
  url: string
  title?: string | null
  description?: string | null
  content: string
}

export type SummarizeSiteInput = {
  projectId: string
  locale: string
  pages: CrawlPageSnapshot[]
}

export type DiscoverySummary = {
  businessSummary: string
  audience: string[]
  products?: string[]
  topicClusters: string[]
}

export type ExpandSeedsInput = {
  projectId: string
  locale: string
  topicClusters: string[]
  maxKeywords: number
}

export type SeedKeyword = {
  keyword: string
  topic: string
}

export type DraftTitleOutlineInput = {
  keyword: string
  locale: string
  tone?: string
}

export type OutlineSection = {
  heading: string
  subpoints?: string[]
}

export type DraftTitleOutlineResult = {
  title: string
  outline: OutlineSection[]
}

export type GenerateArticleInput = {
  title: string
  outline: OutlineSection[]
  keyword: string
  locale: string
  tone?: string
}

export type GeneratedArticleResult = {
  bodyHtml: string
  media?: Array<{ src: string; alt?: string; caption?: string }>
}

export interface LLMProvider {
  summarizeSite(input: SummarizeSiteInput): Promise<DiscoverySummary>
  expandSeedKeywords(input: ExpandSeedsInput): Promise<SeedKeyword[]>
  draftTitleOutline(input: DraftTitleOutlineInput): Promise<DraftTitleOutlineResult>
  generateArticle(input: GenerateArticleInput): Promise<GeneratedArticleResult>
}
