import type { CMSConnector } from '../../shared/interface'
import { createStubConnector } from '../../shared/stub'

export const shopifyConnector = createStubConnector('shopify', 'Shopify', {
  docsUrl: '/docs/research/integrations/shopify.md'
})

export const connectors: CMSConnector[] = [shopifyConnector]
