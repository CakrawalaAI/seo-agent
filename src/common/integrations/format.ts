export type IntegrationLike = {
  id?: string
  type: string
  configJson?: Record<string, unknown> | null
}

export function formatIntegrationLabel(integration: IntegrationLike) {
  if (integration.type === 'webhook') {
    const targetUrl = getConfigString(integration.configJson, 'targetUrl')
    if (typeof targetUrl === 'string') {
      try {
        const parsed = new URL(targetUrl)
        return parsed.host
      } catch {
        return targetUrl
      }
    }
    return 'Webhook'
  }

  return integration.type
}

function getConfigString(config: Record<string, unknown> | null | undefined, key: string) {
  const value = config?.[key]
  return typeof value === 'string' ? value : null
}
