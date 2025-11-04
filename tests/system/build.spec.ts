import { describe, it, expect } from 'vitest'
import { execSync } from 'node:child_process'

const skip = process.env.SKIP_BUILD_TEST === '1'

describe.skipIf(skip)('system: build pipeline', () => {
  it('vite build succeeds', () => {
    execSync('bunx vite build --mode=test', { stdio: 'ignore' })
    expect(true).toBe(true)
  }, { timeout: 20000 })
})
