import type { CMSConnector } from '../../shared/interface'
import { createStubConnector } from '../../shared/stub'

export const hubspotConnector = createStubConnector('hubspot', 'HubSpot', {
  docsUrl: '/docs/research/integrations/hubspot.md'
})

export const connectors: CMSConnector[] = [hubspotConnector]
