import type { Article } from '@entities/article/domain/article'
import type { IntegrationConfig } from '@entities/integration/domain/integration'
import type { CMSConnector, PublishResult } from './interface'
import { config } from '@common/config'
import { buildPortableArticle } from './interface'
import { log } from '@src/common/logger'

/**
 * Framer connector configuration.
 */
type FramerConfig = IntegrationConfig & {
  /** Framer site ID or domain */
  siteId?: string
  /** API token (if Framer provides API, otherwise webhook URL) */
  apiToken?: string
  /** Collection ID in Framer CMS */
  collectionId?: string
}

/**
 * Framer connector implementation.
 *
 * NOTE: Framer does not have a public CMS API as of 2024.
 * This connector is a stub that would typically use a webhook receiver
 * or a custom Framer plugin to sync content.
 *
 * Recommended approach: Use webhook connector with a Framer-hosted receiver endpoint.
 */
class FramerConnector implements CMSConnector {
  readonly name = 'Framer'
  readonly type = 'framer'

  async publish(article: Article, cfg: IntegrationConfig): Promise<PublishResult | null> {
    const framerConfig = cfg as FramerConfig

    if (!framerConfig.siteId) {
      log.error('[Framer] Missing required config: siteId')
      return null
    }

    const portable = buildPortableArticle(article)

    // TODO: Implement Framer-specific integration
    // Possible approaches:
    // 1. POST to a Framer-hosted webhook receiver (custom code component)
    // 2. Use Framer plugin/extension API (if they release one)
    // 3. Push to Framer CMS via undocumented API (not recommended)

    if (!config.providers.allowStubs) {
      throw new Error('Framer connector not implemented; enable stubs in dev or use webhook/webflow')
    }
    log.warn('[Framer] Connector not yet implemented, returning stub')
    return {
      externalId: `framer_stub_${article.id}`,
      url: `https://${framerConfig.siteId}.framer.website/${portable.slug}`,
      metadata: { note: 'Framer has no public API; use webhook receiver' }
    }
  }

  async test(config: IntegrationConfig): Promise<boolean> {
    // No way to test without actual API
    log.warn('[Framer] Test not implemented (no public API)')
    return false
  }
}

/**
 * Singleton Framer connector instance.
 */
export const framerConnector = new FramerConnector()
