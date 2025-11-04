import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { loader as onboardingLoader } from '../src/pages/onboarding/loader'

function createFakeQC() {
  const calls: Array<{ key: unknown; fn: Function }> = []
  const qc = {
    ensureQueryData: vi.fn(async ({ queryKey, queryFn }: any) => {
      calls.push({ key: queryKey, fn: queryFn })
      return queryFn ? queryFn() : null
    })
  }
  return { qc, calls }
}

describe('route loaders', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ items: [], project: { id: 'proj_1', name: 'X', defaultLocale: 'en-US' } }), {
        headers: { 'content-type': 'application/json' }
      })
    ) as any
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })
  it('onboarding loader primes session and website lookup', async () => {
    const { qc, calls } = createFakeQC()
    await onboardingLoader({ context: { queryClient: qc as any }, search: { websiteId: 'site_1' } } as any)
    const keys = calls.map((c) => JSON.stringify(c.key))
    expect(keys.some((k) => k.includes('me'))).toBe(true)
    expect(keys.some((k) => k.includes('websites'))).toBe(true)
  })
})
