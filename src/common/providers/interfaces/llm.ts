import type { ArticleOutlineSection } from '@entities/article/domain/article'

export interface LlmProvider {
  summarize(
    pages: Array<{ url: string; text: string }>
  ): Promise<{ businessSummary: string; topicClusters: string[] }>

  draftOutline(keyword: string, locale: string): Promise<{ title: string; outline: ArticleOutlineSection[] }>

  generateBody(args: {
    title: string
    outline: ArticleOutlineSection[]
    serpDump?: string
    competitorDump?: string
    tone?: string
    locale?: string
  }): Promise<{ bodyHtml: string }>

  factCheck?(args: {
    title: string
    bodyPreview?: string
    citations?: Array<{ title?: string; url: string; snippet?: string }>
  }): Promise<{ score: number; notes?: string }>

  // Optional: rank top-N representative URLs from sitemap
  rankRepresentatives?(siteUrl: string, candidates: string[], maxN: number): Promise<string[]>
}
