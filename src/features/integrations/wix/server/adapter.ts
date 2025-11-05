import type { CMSConnector } from '../../shared/interface'
import { createStubConnector } from '../../shared/stub'

export const wixConnector = createStubConnector('wix', 'Wix', {
  docsUrl: '/docs/research/integrations/wix.md'
})

export const connectors: CMSConnector[] = [wixConnector]
