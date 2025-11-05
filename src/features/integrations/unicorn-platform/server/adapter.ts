import type { CMSConnector } from '../../shared/interface'
import { createStubConnector } from '../../shared/stub'

export const unicornPlatformConnector = createStubConnector('unicorn-platform', 'Unicorn Platform', {
  docsUrl: '/docs/research/integrations/unicorn-platform.md'
})

export const connectors: CMSConnector[] = [unicornPlatformConnector]
