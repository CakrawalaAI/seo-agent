import { describe, it, expect } from 'vitest'
import { Route as OrgsRoute } from '../src/app/routes/api/orgs'
import { session } from '../src/common/infra/session'
import { getLastEmail } from '../src/common/infra/email'

describe('org invite email stub', () => {
  it('returns token and sends stub email', async () => {
    const cookie = session.set({ user: { email: 'admin@ex.com' }, activeOrg: { id: 'org-dev', plan: 'starter' } })
    const req = new Request('http://x/api/orgs', { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify({ action: 'invite', email: 'user@ex.com' }) })
    const res = await (OrgsRoute as any).options.server.handlers.POST({ request: req })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.token).toBeTruthy()
    const last = getLastEmail()
    expect(last?.to).toBe('user@ex.com')
  })
})

