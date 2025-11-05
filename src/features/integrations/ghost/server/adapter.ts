import type { CMSConnector } from '../../shared/interface'
import { createStubConnector } from '../../shared/stub'

export const ghostConnector = createStubConnector('ghost', 'Ghost', {
  docsUrl: '/docs/research/integrations/ghost.md'
})

export const connectors: CMSConnector[] = [ghostConnector]
