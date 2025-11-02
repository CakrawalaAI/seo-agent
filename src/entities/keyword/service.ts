import { fetchJson, patchJson } from '@common/http/json'
import type { Keyword, KeywordScope } from './domain/keyword'

export type KeywordStatus = 'recommended' | 'planned' | 'generated' | 'all'

type FetchKeywordOptions = {
  status?: KeywordStatus
  scope?: KeywordScope | 'all'
  limit?: number
}

export function fetchKeywords(projectId: string, options: FetchKeywordOptions = {}) {
  const params = new URLSearchParams()
  const limit = options.limit && options.limit > 0 ? options.limit : 100
  params.set('limit', String(limit))
  if (options.status && options.status !== 'all') {
    params.set('status', options.status)
  }
  if (options.scope && options.scope !== 'all') {
    params.set('scope', options.scope)
  }
  return fetchJson<{ items: Keyword[]; nextCursor?: string }>(
    `/api/projects/${projectId}/keywords?${params.toString()}`
  )
}

export function patchKeyword(
  keywordId: string,
  payload: Partial<Pick<Keyword, 'phrase' | 'status' | 'starred' | 'scope'>>
) {
  return patchJson<Keyword>(`/api/keywords/${keywordId}`, payload)
}
