import type { CMSConnector } from './interface'
import type { Article } from '@entities/article/domain/article'
import type { IntegrationConfig } from '@entities/integration/domain/integration'
import type { PublishResult } from './interface'

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
      console.error(`[Connector Registry] No connector registered for type: ${type}`)
      return null
    }

    try {
      return await connector.publish(article, config)
    } catch (error) {
      console.error(`[Connector Registry] Publish failed for ${type}:`, error)
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
      console.warn(`[Connector Registry] No test method for type: ${type}`)
      return false
    }

    try {
      return await connector.test(config)
    } catch (error) {
      console.error(`[Connector Registry] Test failed for ${type}:`, error)
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
  // Lazy-load connectors to avoid circular deps and allow tree-shaking
  import('./webhook').then((m) => connectorRegistry.register(m.webhookConnector))
  import('./webflow').then((m) => connectorRegistry.register(m.webflowConnector))
  import('./wordpress').then((m) => connectorRegistry.register(m.wordpressConnector))
  import('./framer').then((m) => connectorRegistry.register(m.framerConnector))

  // Future connectors:
  // import('./shopify').then((m) => connectorRegistry.register(m.shopifyConnector))
  // import('./wix').then((m) => connectorRegistry.register(m.wixConnector))
  // import('./medium').then((m) => connectorRegistry.register(m.mediumConnector))
}
