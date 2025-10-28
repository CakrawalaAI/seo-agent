import { describe, it, expect } from 'vitest'
import { requireProjectAccess } from '../src/app/api-utils'
import { projectsRepo } from '../src/entities/project/repository'
import { session } from '../src/common/infra/session'

function reqWithCookie(cookie: string) {
  return new Request('http://localhost/test', { headers: { cookie } })
}

describe('RBAC helpers', () => {
  it('denies cross-org project access', async () => {
    const p = projectsRepo.create({ orgId: 'org-b', name: 'B', siteUrl: 'https://b.com', defaultLocale: 'en-US' })
    const cookie = session.set({ user: { email: 'a@ex.com' }, activeOrg: { id: 'org-a', plan: 'starter' } })
    const req = reqWithCookie(cookie)
    let status = 200
    try {
      await requireProjectAccess(req, p.id)
    } catch (e: any) {
      status = (e as Response).status
    }
    expect(status).toBe(403)
  })

  it('allows same-org project access', async () => {
    const p = projectsRepo.create({ orgId: 'org-a', name: 'A', siteUrl: 'https://a.com', defaultLocale: 'en-US' })
    const cookie = session.set({ user: { email: 'a@ex.com' }, activeOrg: { id: 'org-a', plan: 'starter' } })
    const req = reqWithCookie(cookie)
    await expect(requireProjectAccess(req, p.id)).resolves.toBeTruthy()
  })
})

