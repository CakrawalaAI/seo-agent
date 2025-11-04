import type { WebsiteIntegration, IntegrationStatus } from '@entities'

export type IntegrationAvailability = 'ga' | 'beta' | 'planned'

export type IntegrationConnectMode = 'inline-form' | 'oauth' | 'docs-only' | 'one-click'

export type IntegrationConfigFieldType = 'text' | 'textarea' | 'password' | 'url' | 'select'

export type IntegrationConfigFieldOption = {
  label: string
  value: string
}

export type IntegrationConfigField = {
  key: string
  label: string
  type: IntegrationConfigFieldType
  required?: boolean
  secret?: boolean
  placeholder?: string
  helpText?: string
  options?: IntegrationConfigFieldOption[]
}

export type IntegrationManifest = {
  type: string
  name: string
  description: string
  availability: IntegrationAvailability
  category: 'cms' | 'api' | 'automation'
  connectMode: IntegrationConnectMode
  supportsTest: boolean
  supportsToggle: boolean
  supportsAutoActivate: boolean
  docsUrl?: string
  comingSoon?: boolean
  configFields?: IntegrationConfigField[]
  quickActions?: Array<{ label: string; command: string }>
}

export type IntegrationViewStatus = IntegrationStatus | 'not_connected' | 'coming_soon'

export type WebsiteIntegrationView = {
  id: string | null
  manifest: IntegrationManifest
  integration: WebsiteIntegration | null
  status: IntegrationViewStatus
  isActive: boolean
  isConfigured: boolean
  supportsOneClick: boolean
  missingCapabilities?: string[]
}
