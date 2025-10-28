import { describe, it, expect, beforeAll } from 'vitest'

describe('compile: API route modules', () => {
  beforeAll(() => {
    process.env.E2E_NO_AUTH = '1'
  })

  it('imports /api/projects route (server handlers) without errors', async () => {
    const mod = await import('@app/routes/api/projects.ts')
    expect(mod).toBeTruthy()
    expect((mod as any).Route).toBeTruthy()
  })

  it('imports /api/orgs route (server handlers) without errors', async () => {
    const mod = await import('@app/routes/api/orgs.ts')
    expect(mod).toBeTruthy()
    expect((mod as any).Route).toBeTruthy()
  })
})
