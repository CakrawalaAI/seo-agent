import { session, type SessionPayload } from '@common/infra/session'

const DEFAULT_SESSION: SessionPayload = {
  user: { email: 'smoke@example.com', name: 'Smoke Tester' },
  orgs: [{ id: 'org_mock', name: 'Smoke Org', plan: 'growth' }],
  activeOrg: { id: 'org_mock', plan: 'growth' },
  entitlements: { projectQuota: 5, monthlyPostCredits: 30, dailyArticles: 2 },
  activeProjectId: 'proj_mock'
}

export function buildSmokeSessionCookie(overrides: Partial<SessionPayload> = {}) {
  const payload: SessionPayload & { activeWebsiteId?: string | null } = { ...DEFAULT_SESSION, ...overrides }
  if (payload.activeProjectId && !('activeWebsiteId' in payload)) {
    payload.activeWebsiteId = payload.activeProjectId
  }
  const raw = session.set(payload)
  const [name, rest] = raw.split('=', 2)
  const value = rest.split(';')[0] ?? ''
  return { name, value }
}
