import type { CMSConnector } from '../../shared/interface'
import { createStubConnector } from '../../shared/stub'

export const wordpressOrgConnector = createStubConnector('wordpress-org', 'WordPress.org', {
  supportsTest: true,
  docsUrl: '/docs/research/integrations/wordpress.md'
})

export const wordpressComConnector = createStubConnector('wordpress-com', 'WordPress.com', {
  supportsTest: true,
  docsUrl: '/docs/research/integrations/wordpress.md'
})

export const connectors: CMSConnector[] = [wordpressOrgConnector, wordpressComConnector]
