import type { CMSConnector } from '../../shared/interface'
import { createStubConnector } from '../../shared/stub'

export const restApiConnector = createStubConnector('rest-api', 'REST API', {
  docsUrl: '/docs/research/integrations/rest-api.md'
})

export const connectors: CMSConnector[] = [restApiConnector]
