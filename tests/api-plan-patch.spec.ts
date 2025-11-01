import { describe, it, expect } from 'vitest'
import { planRepo } from '../src/entities/plan/repository'
import { keywordsRepo } from '../src/entities/keyword/repository'
import { Route as PlanPatchRoute } from '../src/app/routes/api/plan/$planId'

describe('plan PATCH', () => {
  it('updates title and outline', async () => {
    const project = await (await import('../src/entities/project/repository')).projectsRepo.create({ orgId: 'org-dev', name: 'PlanPatch', siteUrl: 'https://example.com', defaultLocale: 'en-US' })
    const projectId = project.id
    await keywordsRepo.generate(projectId, 'en-US')
    const { created } = await planRepo.createPlan(projectId, 1)
    const item = (await planRepo.list(projectId, 1))[0]!
    const req = new Request('http://x/api/plan/1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: 'New Title', outline: [{ heading: 'H2 One' }], status: 'planned' })
    })
    const res = await (PlanPatchRoute as any).options.server.handlers.PATCH({ params: { planId: item.id }, request: req })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.title).toBe('New Title')
    expect(Array.isArray(json.outlineJson)).toBe(true)
  })
})
