import type { CMSConnector } from '../../shared/interface'
import { createStubConnector } from '../../shared/stub'

export const zapierConnector = createStubConnector('zapier', 'Zapier / Automation', {
  docsUrl: '/docs/research/integrations/zapier-style.md'
})

export const connectors: CMSConnector[] = [zapierConnector]
