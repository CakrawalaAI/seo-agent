import type { CMSConnector, PublishResult } from '../shared/interface'
import type { Article } from '@entities/article/domain/article'
import type { IntegrationConfig } from '@entities/integration/domain/integration'
import { log } from '@src/common/logger'
import { ConnectorNotReadyError } from '../shared/errors'

/**
 * Registry of available CMS connectors.
 * Connectors are lazy-loaded on first use.
 */
class ConnectorRegistry {
  private connectors = new Map<string, CMSConnector>()

  /**
   * Register a connector implementation.
   */
  register(connector: CMSConnector): void {
    this.connectors.set(connector.type, connector)
  }

  /**
   * Get a connector by type.
   * @param type - Integration type (e.g., "webhook", "webflow", "wordpress")
   * @returns Connector instance or undefined
   */
  get(type: string): CMSConnector | undefined {
    return this.connectors.get(type)
  }

  /**
   * Publish an article via the specified connector.
   * @param type - Integration type
   * @param article - Article to publish
   * @param config - Integration configuration
   * @returns PublishResult or null if connector not found or publish failed
   */
  async publish(
    type: string,
    article: Article,
    config: IntegrationConfig
  ): Promise<PublishResult | null> {
    const connector = this.get(type)
    if (!connector) {
      log.error(`[Connector Registry] No connector registered for type: ${type}`)
      return null
    }

    try {
      return await connector.publish(article, config)
    } catch (error) {
      if (error instanceof ConnectorNotReadyError) {
        throw error
      }
      log.error(`[Connector Registry] Publish failed for ${type}:`, error)
      return null
    }
  }

  /**
   * Test a connector configuration.
   * @param type - Integration type
   * @param config - Integration configuration
   * @returns true if test passed, false otherwise
   */
  async test(type: string, config: IntegrationConfig): Promise<boolean> {
    const connector = this.get(type)
    if (!connector || !connector.test) {
      log.warn(`[Connector Registry] No test method for type: ${type}`)
      return false
    }

    try {
      return await connector.test(config)
    } catch (error) {
      if (error instanceof ConnectorNotReadyError) {
        throw error
      }
      log.error(`[Connector Registry] Test failed for ${type}:`, error)
      return false
    }
  }

  /**
   * List all registered connector types.
   */
  list(): string[] {
    return Array.from(this.connectors.keys())
  }
}

/**
 * Global connector registry instance.
 */
export const connectorRegistry = new ConnectorRegistry()

/**
 * Initialize connectors.
 * This is called at app startup to register all available connectors.
 */
export function initConnectors(): void {
  const modules: Array<Promise<{ connectors?: CMSConnector[] }>> = [
    import('../webhook/server/adapter'),
    import('../rest-api/server/adapter'),
    import('../wordpress/server/adapter'),
    import('../webflow/server/adapter'),
    import('../shopify/server/adapter'),
    import('../ghost/server/adapter'),
    import('../hubspot/server/adapter'),
    import('../notion/server/adapter'),
    import('../squarespace/server/adapter'),
    import('../wix/server/adapter'),
    import('../framer/server/adapter'),
    import('../unicorn-platform/server/adapter'),
    import('../zapier/server/adapter')
  ]

  void Promise.all(
    modules.map((promise) =>
      promise.then((mod) => {
        for (const connector of mod.connectors ?? []) {
          connectorRegistry.register(connector)
        }
      })
    )
  )
}
