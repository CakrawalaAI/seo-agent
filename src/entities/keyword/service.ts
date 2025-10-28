import { fetchJson, patchJson } from '@common/http/json'
import type { Keyword } from './domain/keyword'

export type KeywordStatus = 'recommended' | 'planned' | 'generated' | 'all'

export function fetchKeywords(projectId: string, status: KeywordStatus = 'all') {
  const params = new URLSearchParams({ limit: '100' })
  if (status && status !== 'all') {
    params.set('status', status)
  }
  return fetchJson<{ items: Keyword[]; nextCursor?: string }>(
    `/api/projects/${projectId}/keywords?${params.toString()}`
  )
}

export function patchKeyword(keywordId: string, payload: Partial<Pick<Keyword, 'phrase' | 'status' | 'starred'>>) {
  return patchJson<Keyword>(`/api/keywords/${keywordId}`, payload)
}
