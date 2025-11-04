import { describe, it, expect } from 'vitest'
import { Route as CrawlPagesRoute } from '../src/app/routes/api/crawl/pages'

describe('crawl pages route', () => {
  it('exports server handlers', async () => {
    expect((CrawlPagesRoute as any).options?.server?.handlers).toBeTruthy()
  })
})
