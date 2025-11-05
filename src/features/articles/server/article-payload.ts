import type {
  ArticleGenerationContext,
  ArticleGenerationPayload,
  ArticleOutlineSection
} from '@entities/article/domain/article'

type BuildPayloadInput = {
  articleId: string
  websiteId?: string | null
  title?: string | null
  targetKeyword?: string | null
  locale?: string | null
  outline: ArticleOutlineSection[]
  bodyHtml: string
  generatedAt?: Date
  context: ArticleGenerationContext
}

export function buildArticleGenerationPayload(input: BuildPayloadInput): ArticleGenerationPayload {
  const generatedAt = input.generatedAt ?? new Date()
  const plain = stripHtml(input.bodyHtml || '')
  const wordCount = countWords(plain)
  const readingMinutes = Math.max(1, Math.round(wordCount / 200) || 1)
  return {
    version: 1,
    articleId: input.articleId,
    websiteId: input.websiteId ?? null,
    title: input.title ?? null,
    targetKeyword: input.targetKeyword ?? null,
    locale: input.locale ?? null,
    outline: input.outline,
    bodyHtml: input.bodyHtml,
    wordCount,
    readingMinutes,
    generatedAt: generatedAt.toISOString(),
    context: input.context
  }
}

function stripHtml(html: string): string {
  return String(html || '')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
}

function countWords(text: string): number {
  const words = text.trim().split(/\s+/)
  return words.filter(Boolean).length
}
