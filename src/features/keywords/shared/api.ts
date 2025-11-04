export type KeywordStatus = 'recommended' | 'planned' | 'generated' | 'all'

type FetchKeywordOptions = {
  status?: KeywordStatus
  scope?: 'auto' | 'include' | 'exclude' | 'all'
  limit?: number
}

export async function fetchKeywords(websiteId: string, options: FetchKeywordOptions = {}) {
  const params = new URLSearchParams()
  const limit = options.limit && options.limit > 0 ? options.limit : 100
  params.set('limit', String(limit))
  if (options.status && options.status !== 'all') {
    params.set('status', options.status)
  }
  if (options.scope && options.scope !== 'all') {
    params.set('scope', options.scope)
  }
  const response = await fetch(`/api/websites/${websiteId}/keywords?${params.toString()}`, {
    credentials: 'include'
  })
  if (!response.ok) {
    throw new Error('Failed to load keywords')
  }
  return response.json() as Promise<{ items: Array<Record<string, unknown>>; nextCursor?: string }>
}
