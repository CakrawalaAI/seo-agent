export type KeywordStatus = 'recommended' | 'planned' | 'generated' | 'all'

export async function fetchKeywords(projectId: string, status: KeywordStatus = 'all') {
  const params = new URLSearchParams({ limit: '100' })
  if (status && status !== 'all') {
    params.set('status', status)
  }
  const response = await fetch(`/api/projects/${projectId}/keywords?${params.toString()}`, {
    credentials: 'include'
  })
  if (!response.ok) {
    throw new Error('Failed to load keywords')
  }
  return response.json() as Promise<{ items: Array<Record<string, unknown>>; nextCursor?: string }>
}
