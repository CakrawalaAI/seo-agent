import type { Article } from '@entities/article/domain/article'

export function buildArticleJsonLd(article: Article, site?: { name?: string; url?: string | null }) {
  const headline = String(article.title || '').slice(0, 110)
  const datePublished = article.publishDate || article.scheduledDate || article.generationDate || new Date().toISOString()
  const dateModified = article.updatedAt || datePublished
  const url = article.url || undefined
  const publisherName = site?.name || undefined
  const obj: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline,
    datePublished,
    dateModified
  }
  if (publisherName) obj.publisher = { '@type': 'Organization', name: publisherName }
  if (url) obj.url = url
  return obj
}

export function stringifyJsonLd(obj: any): string {
  try { return JSON.stringify(obj) } catch { return '{}' }
}

