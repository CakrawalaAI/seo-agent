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
  beforeEach(() => {
    vi.restoreAllMocks()
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ items: [], project: { id: 'proj_1', name: 'X', defaultLocale: 'en-US' } }), {
        headers: { 'content-type': 'application/json' }
      })
    ) as any
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('redirects to ensure when only site is provided', async () => {
    const { qc } = createFakeQC()
    let thrown: any = null
    try {
      await onboardingLoader({ context: { queryClient: qc as any }, search: { site: 'https://example.com' } } as any)
    } catch (e) {
      thrown = e
    }
    expect(thrown).toBeTruthy()
  })

  it('primes project + snapshot when projectId is present', async () => {
    const { qc, calls } = createFakeQC()
    await onboardingLoader({ context: { queryClient: qc as any }, search: { projectId: 'proj_9', project: 'example-com' } } as any)
    const keys = calls.map((c) => JSON.stringify(c.key)).join('\n')
    expect(keys).toContain('projectSnapshot')
    expect(keys).toContain('"project","proj_9"')
  })
})

