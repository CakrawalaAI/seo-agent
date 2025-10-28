import { describe, it, expect } from 'vitest'
import { Route as CrawlPagesRoute } from '../src/app/routes/api/crawl/pages'
import { crawlRepo } from '../src/entities/crawl/repository'

describe('crawl pages filter', () => {
  beforeAll(() => { (process as any).env.E2E_NO_AUTH = '1' })
  it('filters by q over url/title', async () => {
    const projectId = 'proj_crawl_q'
    const now = new Date().toISOString()
    crawlRepo.addOrUpdate(projectId, { url: 'https://ex.com/about', depth: 1, status: 'completed', metaJson: { title: 'About Us' }, extractedAt: now })
    crawlRepo.addOrUpdate(projectId, { url: 'https://ex.com/blog', depth: 1, status: 'completed', metaJson: { title: 'Blog' }, extractedAt: now })
    const req = new Request(`http://x/api/crawl/pages?projectId=${projectId}&limit=10&q=about`)
    const res = await (CrawlPagesRoute as any).options.server.handlers.GET({ request: req })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.items.length).toBe(1)
    expect(json.items[0].url).toContain('about')
  })
})
