import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fetchKeywords } from '../src/routes/projects/$projectId/keywords.tsx'
import { fetchArticles } from '../src/routes/projects/$projectId/articles.tsx'

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
    await fetchKeywords('proj-1', 'all')
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/projects/proj-1/keywords?limit=100',
      expect.objectContaining({ credentials: 'include' })
    )
  })

  it('requests articles from project-scoped route', async () => {
    await fetchArticles('proj-9')
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/projects/proj-9/articles?limit=60',
      expect.objectContaining({ credentials: 'include' })
    )
  })
})
