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
  afterEach(() => {
    vi.restoreAllMocks()
  })
  it('onboarding loader currently performs no prefetched queries', async () => {
    const { qc, calls } = createFakeQC()
    await onboardingLoader({ context: { queryClient: qc as any }, search: { websiteId: 'site_1' } } as any)
    expect(calls).toHaveLength(0)
    expect(qc.ensureQueryData).not.toHaveBeenCalled()
  })
})
