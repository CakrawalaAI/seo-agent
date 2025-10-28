import { fetchJson } from '@common/http/json'
import type { MeSession } from './domain/org'

export function fetchSession() {
  return fetchJson<MeSession>('/api/me')
}
