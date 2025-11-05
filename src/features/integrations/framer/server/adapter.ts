import type { CMSConnector } from '../../shared/interface'
import { createStubConnector } from '../../shared/stub'

export const framerConnector = createStubConnector('framer', 'Framer', {
  docsUrl: '/docs/research/integrations/framer.md'
})

export const connectors: CMSConnector[] = [framerConnector]
