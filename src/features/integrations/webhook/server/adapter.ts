import type { CMSConnector } from '../../shared/interface'
import { createStubConnector } from '../../shared/stub'

export const webhookConnector = createStubConnector('webhook', 'Webhook', {
  supportsTest: true,
  docsUrl: '/docs/research/integrations/webhook.md'
})

export const connectors: CMSConnector[] = [webhookConnector]
