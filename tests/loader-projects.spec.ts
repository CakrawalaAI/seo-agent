import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { loader as projectsIndexLoader } from '../src/pages/projects/index/loader'
import { loader as articleLoader } from '../src/pages/projects/$projectId/articles/$articleId/loader'

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
  it('projects/index primes session and project list', async () => {
    const { qc, calls } = createFakeQC()
    await projectsIndexLoader({ context: { queryClient: qc as any } } as any)
    const keys = calls.map((c) => JSON.stringify(c.key))
    expect(keys.some((k) => k.includes('me'))).toBe(true)
    expect(keys.some((k) => k.includes('projects'))).toBe(true)
  })

  it('article editor primes article + snapshot', async () => {
    const { qc, calls } = createFakeQC()
    await articleLoader({ context: { queryClient: qc as any }, params: { projectId: 'proj_1', articleId: 'art_1' } } as any)
    const joined = calls.map((c) => JSON.stringify(c.key)).join('\n')
    expect(joined).toContain('article')
    expect(joined).toContain('projectSnapshot')
  })
})
