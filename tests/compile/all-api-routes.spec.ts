import { describe, it, expect, beforeAll } from 'vitest'

describe('compile: all API routes importable', () => {
  beforeAll(() => {
    process.env.E2E_NO_AUTH = '1'
  })

  it('imports every file under src/app/routes/api/**', async () => {
    const globbed = import.meta.glob('/src/app/routes/api/**/*.ts')
    const entries = Object.entries(globbed)
    expect(entries.length).toBeGreaterThan(0)
    for (const [key, loader] of entries) {
      const mod = await loader()
      expect(mod).toBeTruthy()
    }
  })
})
