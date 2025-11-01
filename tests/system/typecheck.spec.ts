import { describe, it, expect } from 'vitest'
import { execSync } from 'node:child_process'

const skip = process.env.SKIP_TYPECHECK_TEST === '1'

describe.skipIf(skip)('system: typecheck', () => {
  it('passes tsc --noEmit', () => {
    execSync('bun run typecheck', { stdio: 'ignore' })
    expect(true).toBe(true)
  })
})
