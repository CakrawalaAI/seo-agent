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

describe('onboarding loader', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns null when only site is provided (handled client-side)', async () => {
    const { qc } = createFakeQC()
    await expect(onboardingLoader({ context: { queryClient: qc as any }, search: { site: 'https://example.com' } } as any)).resolves.toBeNull()
    expect(qc.ensureQueryData).not.toHaveBeenCalled()
  })

  it('no longer primes project snapshot server-side', async () => {
    const { qc, calls } = createFakeQC()
    await onboardingLoader({ context: { queryClient: qc as any }, search: { projectId: 'proj_9', project: 'example-com' } } as any)
    expect(calls).toHaveLength(0)
  })
})
