import type { Article } from '@entities/article/domain/article'
import type { IntegrationConfig } from '@entities/integration/domain/integration'
import type { CMSConnector, PublishResult } from './interface'
import { config } from '@common/config'
import { buildPortableArticle } from './interface'

/**
 * WordPress connector configuration.
 */
type WordPressConfig = IntegrationConfig & {
  /** WordPress site URL (e.g., https://example.com) */
  siteUrl?: string
  /** Application password or JWT token */
  apiToken?: string
  /** WordPress username (if using app password) */
  username?: string
  /** Post status: "publish" | "draft" | "pending" */
  status?: 'publish' | 'draft' | 'pending'
}

/**
 * WordPress REST API connector implementation.
 * Docs: https://developer.wordpress.org/rest-api/reference/posts/
 *
 * TODO: Implement real WordPress REST API integration
 * - POST /wp-json/wp/v2/posts (create post)
 * - Authentication: Basic (app password) or JWT
 * - Handle featured image upload
 * - Map categories/tags
 */
class WordPressConnector implements CMSConnector {
  readonly name = 'WordPress'
  readonly type = 'wordpress'

  async publish(article: Article, cfg: IntegrationConfig): Promise<PublishResult | null> {
    const wpConfig = cfg as WordPressConfig

    if (!wpConfig.siteUrl || !wpConfig.apiToken) {
      console.error('[WordPress] Missing required config: siteUrl, apiToken')
      return null
    }

    const portable = buildPortableArticle(article)

    // TODO: Implement real API call
    // const url = `${wpConfig.siteUrl}/wp-json/wp/v2/posts`
    // const auth = wpConfig.username
    //   ? `Basic ${Buffer.from(`${wpConfig.username}:${wpConfig.apiToken}`).toString('base64')}`
    //   : `Bearer ${wpConfig.apiToken}`
    //
    // const payload = {
    //   title: portable.title,
    //   content: portable.bodyHtml,
    //   excerpt: portable.excerpt,
    //   status: wpConfig.status ?? 'draft',
    //   slug: portable.slug
    // }
    //
    // const res = await fetch(url, {
    //   method: 'POST',
    //   headers: {
    //     'authorization': auth,
    //     'content-type': 'application/json'
    //   },
    //   body: JSON.stringify(payload)
    // })

    if (!config.providers.allowStubs) {
      throw new Error('WordPress connector not implemented; enable stubs in dev or use webhook/webflow')
    }
    console.warn('[WordPress] Connector not yet implemented, returning stub')
    return {
      externalId: `wp_stub_${article.id}`,
      url: `${wpConfig.siteUrl}/${portable.slug}`,
      metadata: { status: 'draft (stub)' }
    }
  }

  async test(config: IntegrationConfig): Promise<boolean> {
    const wpConfig = config as WordPressConfig

    if (!wpConfig.siteUrl) return false

    try {
      // Test by fetching WP REST API root
      const res = await fetch(`${wpConfig.siteUrl}/wp-json`)
      return res.ok
    } catch {
      return false
    }
  }
}

/**
 * Singleton WordPress connector instance.
 */
export const wordpressConnector = new WordPressConnector()
