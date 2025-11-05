export type IntegrationStatus =
  | 'draft'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error'
  | 'pending'
  | string

export type IntegrationConfig = Record<string, unknown>

export type WebsiteIntegration = {
  id: string
  websiteId: string
  type: string
  status: IntegrationStatus
  configJson?: IntegrationConfig | null
  secretsId?: string | null
  metadataJson?: Record<string, unknown> | null
  lastTestedAt?: string | null
  lastError?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}
