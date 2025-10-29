import { describe, it, expect, beforeAll } from 'vitest'

describe('compile: all API routes importable', () => {
  beforeAll(() => {
    process.env.E2E_NO_AUTH = '1'
  })

  it('imports every file under src/app/routes/api/**', async () => {
    const globbed = import.meta.glob('/src/app/routes/api/**/*.ts', { eager: true }) as Record<string, unknown>
    const entries = Object.entries(globbed)
    expect(entries.length).toBeGreaterThan(0)
    for (const [key, mod] of entries) {
      expect(mod).toBeTruthy()
    }
  })
})
