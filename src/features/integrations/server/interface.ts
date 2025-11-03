import type { Article } from '@entities/article/domain/article'
import type { IntegrationConfig } from '@entities/integration/domain/integration'

/**
 * Portable article format for cross-CMS publishing.
 * All connectors receive and must handle this normalized structure.
 */
export type PortableArticle = {
  title?: string | null
  excerpt?: string | null
  bodyHtml?: string | null
  outline?: Array<{ level: number; text: string }>
  media?: {
    images?: Array<{ src: string; alt?: string; caption?: string }>
    youtube?: Array<{ id: string; title?: string }>
  }
  seo?: {
    canonical?: string
    metaTitle?: string
    metaDescription?: string
    primaryKeyword?: string
    secondaryKeywords?: string[]
  }
  locale?: string | null
  tags?: string[]
  slug?: string | null
}

/**
 * Result returned by a connector after publishing.
 */
export type PublishResult = {
  /** External ID in the target CMS (e.g., Webflow item ID, WordPress post ID) */
  externalId?: string
  /** Public URL of the published article */
  url?: string
  /** Additional metadata from the CMS */
  metadata?: Record<string, unknown>
}

/**
 * Generic connector interface for CMS publishing.
 * All connectors (webhook, webflow, wordpress, framer, etc.) implement this.
 */
export interface CMSConnector {
  /**
   * Human-readable connector name (e.g., "Webhook", "Webflow", "WordPress")
   */
  readonly name: string

  /**
   * Connector type identifier (matches integration.type in DB)
   */
  readonly type: string

  /**
   * Publish an article to the target CMS.
   * @param article - The article to publish
   * @param config - Integration-specific configuration (parsed from configJson)
   * @returns PublishResult with externalId and url, or null if failed
   */
  publish(article: Article, config: IntegrationConfig): Promise<PublishResult | null>

  /**
   * Test the connection/configuration (optional).
   * @param config - Integration configuration to test
   * @returns true if connection is valid, false otherwise
   */
  test?(config: IntegrationConfig): Promise<boolean>

  /**
   * Build portable article from domain article (optional override).
   * Default implementation provided by base class.
   * @param article - Domain article
   * @returns PortableArticle
   */
  buildPortable?(article: Article): PortableArticle
}

/**
 * Default portable article builder.
 * Connectors can override this via buildPortable() method.
 */
export function buildPortableArticle(article: Article): PortableArticle {
  const outline = (article.outlineJson ?? []).map((s) => ({
    level: 2,
    text: s.heading
  }))

  return {
    title: article.title ?? '',
    excerpt: extractExcerpt(article.bodyHtml),
    bodyHtml: article.bodyHtml ?? '',
    outline,
    // Domain Article currently has no media fields
    media: undefined,
    seo: {
      metaTitle: article.title ?? undefined,
      metaDescription: article.title ? `${article.title.slice(0, 150)}...` : undefined,
      // Domain Article currently has no keyword field
      primaryKeyword: undefined
    },
    locale: article.language ?? 'en',
    tags: [],
    slug: slugify(article.title ?? `article-${article.id}`)
  }
}

/**
 * Extract first 160 chars of HTML as plain text excerpt.
 */
function extractExcerpt(bodyHtml?: string | null): string | null {
  if (!bodyHtml) return null
  const text = bodyHtml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  return text.length > 160 ? `${text.slice(0, 157)}...` : text
}

/**
 * Slugify a string for URL-safe usage.
 */
export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}
