import type { WebsiteIntegration } from '@entities'
import type { IntegrationManifest, WebsiteIntegrationView } from './types'

export const integrationManifests: IntegrationManifest[] = [
  {
    type: 'webhook',
    name: 'Webhook',
    description: 'POST PortableArticle payloads to your infrastructure.',
    availability: 'ga',
    category: 'automation',
    connectMode: 'inline-form',
    supportsTest: true,
    supportsToggle: true,
    supportsAutoActivate: true,
    docsUrl: '/docs/integrations#webhook',
    configFields: [
      {
        key: 'targetUrl',
        label: 'Target URL',
        type: 'url',
        required: true,
        placeholder: 'https://example.com/seo-agent'
      },
      {
        key: 'secret',
        label: 'Shared secret',
        type: 'password',
        required: true,
        helpText: 'We sign payloads with HMAC SHA-256 using this secret.'
      }
    ]
  },
  {
    type: 'rest-api',
    name: 'REST API',
    description: 'Trigger publications directly with signed API requests.',
    availability: 'ga',
    category: 'api',
    connectMode: 'docs-only',
    supportsTest: false,
    supportsToggle: false,
    supportsAutoActivate: false,
    docsUrl: '/docs/api/reference',
    comingSoon: true,
    quickActions: [
      { label: 'View API reference', command: 'open /docs/api/reference' }
    ]
  },
  {
    type: 'wordpress-org',
    name: 'WordPress.org (self-hosted)',
    description: 'Publish via the WordPress REST API using application passwords.',
    availability: 'beta',
    category: 'cms',
    connectMode: 'inline-form',
    supportsTest: true,
    supportsToggle: true,
    supportsAutoActivate: false,
    docsUrl: '/docs/integrations#wordpress-org',
    comingSoon: true,
    configFields: [
      { key: 'siteUrl', label: 'Site URL', type: 'url', required: true, placeholder: 'https://example.com' },
      { key: 'username', label: 'Username (app password auth)', type: 'text' },
      {
        key: 'apiToken',
        label: 'Application Password / JWT token',
        type: 'password',
        required: true,
        helpText: 'Use Application Password for .org or JWT for headless setups.'
      },
      {
        key: 'status',
        label: 'Publish status',
        type: 'select',
        options: [
          { label: 'Draft', value: 'draft' },
          { label: 'Publish', value: 'publish' },
          { label: 'Pending', value: 'pending' }
        ]
      }
    ]
  },
  {
    type: 'wordpress-com',
    name: 'WordPress.com',
    description: 'Connect to WordPress.com sites using OAuth and application passwords.',
    availability: 'beta',
    category: 'cms',
    connectMode: 'oauth',
    supportsTest: true,
    supportsToggle: true,
    supportsAutoActivate: false,
    docsUrl: '/docs/integrations#wordpress-com',
    comingSoon: true
  },
  {
    type: 'webflow',
    name: 'Webflow',
    description: 'Sync articles into a CMS Collection.',
    availability: 'beta',
    category: 'cms',
    connectMode: 'inline-form',
    supportsTest: true,
    supportsToggle: true,
    supportsAutoActivate: false,
    docsUrl: '/docs/integrations#webflow',
    comingSoon: true,
    configFields: [
      { key: 'siteId', label: 'Site ID', type: 'text', required: true },
      { key: 'collectionId', label: 'Collection ID', type: 'text', required: true },
      { key: 'apiToken', label: 'API token', type: 'password', required: true }
    ]
  },
  {
    type: 'shopify',
    name: 'Shopify',
    description: 'Publish to Online Store blogs with Admin API.',
    availability: 'planned',
    category: 'cms',
    connectMode: 'inline-form',
    supportsTest: false,
    supportsToggle: false,
    supportsAutoActivate: false,
    docsUrl: '/docs/integrations#shopify',
    comingSoon: true,
    configFields: [
      { key: 'shopDomain', label: 'Shop domain', type: 'text', placeholder: 'my-store.myshopify.com', required: true },
      { key: 'accessToken', label: 'Admin API access token', type: 'password', required: true },
      { key: 'blogId', label: 'Blog ID', type: 'text' }
    ]
  },
  {
    type: 'ghost',
    name: 'Ghost',
    description: 'Publish drafts or scheduled posts via Admin API.',
    availability: 'planned',
    category: 'cms',
    connectMode: 'inline-form',
    supportsTest: false,
    supportsToggle: false,
    supportsAutoActivate: false,
    docsUrl: '/docs/integrations#ghost',
    comingSoon: true,
    configFields: [
      { key: 'adminUrl', label: 'Admin URL', type: 'url', required: true },
      { key: 'adminApiKey', label: 'Admin API key', type: 'password', required: true }
    ]
  },
  {
    type: 'hubspot',
    name: 'HubSpot',
    description: 'HubSpot CMS blog publishing via private apps.',
    availability: 'planned',
    category: 'cms',
    connectMode: 'oauth',
    supportsTest: false,
    supportsToggle: false,
    supportsAutoActivate: false,
    docsUrl: '/docs/integrations#hubspot',
    comingSoon: true
  },
  {
    type: 'notion',
    name: 'Notion',
    description: 'Sync articles into Notion databases.',
    availability: 'planned',
    category: 'cms',
    connectMode: 'inline-form',
    supportsTest: false,
    supportsToggle: false,
    supportsAutoActivate: false,
    docsUrl: '/docs/integrations#notion',
    comingSoon: true,
    configFields: [
      { key: 'integrationToken', label: 'Integration secret', type: 'password', required: true },
      { key: 'databaseId', label: 'Database ID', type: 'text', required: true }
    ]
  },
  {
    type: 'squarespace',
    name: 'Squarespace',
    description: 'CMS Content API draft publication.',
    availability: 'planned',
    category: 'cms',
    connectMode: 'oauth',
    supportsTest: false,
    supportsToggle: false,
    supportsAutoActivate: false,
    docsUrl: '/docs/integrations#squarespace',
    comingSoon: true
  },
  {
    type: 'wix',
    name: 'Wix',
    description: 'Wix Content Manager API publishing.',
    availability: 'planned',
    category: 'cms',
    connectMode: 'oauth',
    supportsTest: false,
    supportsToggle: false,
    supportsAutoActivate: false,
    docsUrl: '/docs/integrations#wix',
    comingSoon: true
  },
  {
    type: 'framer',
    name: 'Framer',
    description: 'Use webhooks or future CMS APIs to sync content.',
    availability: 'planned',
    category: 'cms',
    connectMode: 'inline-form',
    supportsTest: false,
    supportsToggle: false,
    supportsAutoActivate: false,
    docsUrl: '/docs/integrations#framer',
    comingSoon: true,
    configFields: [
      { key: 'siteId', label: 'Site ID', type: 'text', required: true },
      { key: 'apiToken', label: 'Token', type: 'password' }
    ]
  },
  {
    type: 'unicorn-platform',
    name: 'Unicorn Platform',
    description: 'Import generated articles into Unicorn Platform blog.',
    availability: 'planned',
    category: 'cms',
    connectMode: 'inline-form',
    supportsTest: false,
    supportsToggle: false,
    supportsAutoActivate: false,
    docsUrl: '/docs/integrations#unicorn-platform',
    comingSoon: true,
    configFields: [
      { key: 'apiKey', label: 'API key', type: 'password', required: true }
    ]
  },
  {
    type: 'zapier',
    name: 'Zapier / Make / n8n',
    description: 'Use automation platforms via webhook payloads.',
    availability: 'ga',
    category: 'automation',
    connectMode: 'docs-only',
    supportsTest: false,
    supportsToggle: false,
    supportsAutoActivate: false,
    docsUrl: '/docs/integrations#automation',
    comingSoon: true
  }
]

const manifestByType = new Map(integrationManifests.map((manifest) => [manifest.type, manifest]))

export function getIntegrationManifest(type: string): IntegrationManifest | undefined {
  return manifestByType.get(type)
}

export function buildIntegrationViews(integrations: WebsiteIntegration[]): WebsiteIntegrationView[] {
  const firstByType = new Map<string, WebsiteIntegration>()
  for (const integration of integrations) {
    if (!firstByType.has(integration.type)) {
      firstByType.set(integration.type, integration)
    }
  }

  return integrationManifests.map((manifest) => {
    const integration = firstByType.get(manifest.type) ?? null
    const status = manifest.comingSoon ? 'coming_soon' : integration?.status ?? 'not_connected'
    return {
      id: integration?.id ?? null,
      manifest,
      integration,
      status,
      isActive: integration?.status === 'connected',
      isConfigured: Boolean(integration?.configJson && Object.keys(integration.configJson).length > 0),
      supportsOneClick: manifest.supportsAutoActivate
    }
  })
}
