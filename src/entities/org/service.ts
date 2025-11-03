import { fetchJson, postJson } from '@common/http/json'
import type { MeSession, OrgMember, OrgMemberRole } from './domain/org'

export function fetchSession() {
  return fetchJson<MeSession>('/api/me')
}

export function fetchOrgMembers() {
  return fetchJson<{ items: OrgMember[] }>('/api/orgs/members')
}

export function inviteOrgMember(email: string, role: OrgMemberRole) {
  return postJson<{ token: string; email: string; role: OrgMemberRole; orgId: string }>(
    '/api/orgs',
    { action: 'invite', email, role }
  )
}
