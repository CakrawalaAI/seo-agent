import type { CMSConnector } from '../../shared/interface'
import { createStubConnector } from '../../shared/stub'

export const squarespaceConnector = createStubConnector('squarespace', 'Squarespace', {
  docsUrl: '/docs/research/integrations/squarespace.md'
})

export const connectors: CMSConnector[] = [squarespaceConnector]
