export type IntegrationStatus = 'connected' | 'disconnected' | 'error' | string

export type IntegrationConfig = {
  targetUrl?: string
  secret?: string
  [key: string]: unknown
}

export type ProjectIntegration = {
  id: string
  projectId: string
  type: string
  status: IntegrationStatus
  configJson?: IntegrationConfig | null
  createdAt?: string | null
  updatedAt?: string | null
}
