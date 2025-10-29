import { describe, it, expect, beforeAll } from 'vitest'

describe('compile: auth session & oauth', () => {
  beforeAll(() => {
    process.env.E2E_NO_AUTH = '1'
  })

  it('imports session helper without errors', async () => {
    const mod = await import('@common/infra/session')
    expect(mod).toBeTruthy()
    expect((mod as any).session).toBeTruthy()
  })

  it('imports auth routes (login/callback/logout) without errors', async () => {
    const login = await import('@app/routes/api/auth/login')
    const callback = await import('@app/routes/api/auth/callback')
    const logout = await import('@app/routes/api/auth/logout')
    expect((login as any).Route).toBeTruthy()
    expect((callback as any).Route).toBeTruthy()
    expect((logout as any).Route).toBeTruthy()
  })
})
