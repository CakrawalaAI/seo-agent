import { describe, it, expect, beforeAll } from 'vitest'

describe('compile: auth server', () => {
  beforeAll(() => {
    process.env.E2E_NO_AUTH = '1'
  })

  it('imports @common/auth/server without transform errors', async () => {
    const mod = await import('@common/auth/server')
    expect(mod).toBeTruthy()
    expect(mod.auth).toBeTruthy()
  })
})
