import { describe, it, expect } from 'vitest'
import { Route as LinkGraphRoute } from '../src/app/routes/api/projects/$projectId/link-graph'
import { crawlRepo } from '../src/entities/crawl/repository'

describe('link-graph API (memory path)', () => {
  it('returns nodes and edges from crawlRepo links', async () => {
    const projectId = (await (await import('../src/entities/project/repository')).projectsRepo.create({ orgId: 'org-dev', name: 'LG', siteUrl: 'https://ex.com', defaultLocale: 'en-US' })).id
    await crawlRepo.addOrUpdate(projectId, { url: 'https://ex.com/', depth: 0, status: 'completed', metaJson: { title: 'Home' }, extractedAt: new Date().toISOString() })
    await crawlRepo.addOrUpdate(projectId, { url: 'https://ex.com/about', depth: 1, status: 'completed', metaJson: { title: 'About' }, linksJson: [{ href: 'https://ex.com/' }], extractedAt: new Date().toISOString() })
    const res = await (LinkGraphRoute as any).options.server.handlers.GET({ params: { projectId } })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(Array.isArray(json.nodes)).toBe(true)
    expect(json.edges.length).toBeGreaterThan(0)
  })
})
