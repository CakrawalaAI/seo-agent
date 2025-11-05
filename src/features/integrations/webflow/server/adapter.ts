import type { CMSConnector } from '../../shared/interface'
import { createStubConnector } from '../../shared/stub'

export const webflowConnector = createStubConnector('webflow', 'Webflow', {
  supportsTest: true,
  docsUrl: '/docs/research/integrations/webflow.md'
})

export const connectors: CMSConnector[] = [webflowConnector]
