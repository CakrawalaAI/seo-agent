import type { CMSConnector } from '../../shared/interface'
import { createStubConnector } from '../../shared/stub'

export const notionConnector = createStubConnector('notion', 'Notion', {
  docsUrl: '/docs/research/integrations/notion.md'
})

export const connectors: CMSConnector[] = [notionConnector]
