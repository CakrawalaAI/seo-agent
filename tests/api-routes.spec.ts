import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fetchKeywords } from '../src/entities/keyword/service'

type MockResponse = {
  ok: boolean
  json: () => Promise<unknown>
}

beforeEach(() => {
  vi.restoreAllMocks()
  globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ items: [] }) } as MockResponse)) as any
})

describe('project REST endpoints', () => {
  it('requests keywords from project-scoped route', async () => {
    await fetchKeywords('proj-1', { status: 'all' })
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/projects/proj-1/keywords?limit=100',
      expect.objectContaining({ credentials: 'include' })
    )
  })

})
