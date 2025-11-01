import { describe, it, expect, beforeAll } from 'vitest'
import { join } from 'node:path'
import { readdirSync, statSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

async function loadRoutesViaFs(): Promise<Record<string, unknown>> {
  const root = join(process.cwd(), 'src/app/routes/api')
  const modules: Record<string, unknown> = {}
  function walk(dir: string) {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      const stat = statSync(full)
      if (stat.isDirectory()) {
        walk(full)
      } else if (stat.isFile() && full.endsWith('.ts')) {
        modules[pathToFileURL(full).href] = null
      }
    }
  }
  walk(root)
  for (const key of Object.keys(modules)) {
    modules[key] = await import(key)
  }
  return modules
}

describe('compile: all API routes importable', () => {
  beforeAll(() => {
    process.env.E2E_NO_AUTH = '1'
  })

  it('imports every file under src/app/routes/api/**', async () => {
    const globFn = (import.meta as any)?.glob
    const globbed: Record<string, unknown> = typeof globFn === 'function'
      ? globFn('/src/app/routes/api/**/*.ts', { eager: true }) as Record<string, unknown>
      : await loadRoutesViaFs()
    const entries = Object.entries(globbed)
    expect(entries.length).toBeGreaterThan(0)
    for (const [key, mod] of entries) {
      expect(mod).toBeTruthy()
    }
  })
})
