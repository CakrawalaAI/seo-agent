import { describe, expect, it, vi } from 'vitest'
import { SeoAgentClient } from './client.js'

const jsonResponse = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' }
  })

describe('SeoAgentClient API requests', () => {
  const baseUrl = 'https://api.example.com'

  it('creates plans via /api/plan-items', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ jobId: 'job-123', status: 'queued' }, 202))
    const client = new SeoAgentClient({ baseUrl, fetch: fetchMock })
    await client.createPlan({ projectId: 'proj_1', days: 10 })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toBe(`${baseUrl}/api/plan-items`)
    expect(init?.method).toBe('POST')
    const body = JSON.parse(init?.body as string)
    expect(body.projectId).toBe('proj_1')
    expect(body.days).toBe(10)
  })

  it('updates plan items with PUT /api/plan-items/:id', async () => {
    const samplePlanItem = {
      id: 'plan_1',
      projectId: 'proj_1',
      keywordId: 'kw_1',
      plannedDate: '2024-05-01',
      title: 'Sample Plan',
      outlineJson: [{ heading: 'Intro', subpoints: [] }],
      status: 'planned',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    const fetchMock = vi.fn(async () => jsonResponse(samplePlanItem))
    const client = new SeoAgentClient({ baseUrl, fetch: fetchMock })
    await client.updatePlanItem('plan_1', { status: 'skipped' })

    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toBe(`${baseUrl}/api/plan-items/plan_1`)
    expect(init?.method).toBe('PUT')
    const body = JSON.parse(init?.body as string)
    expect(body.status).toBe('skipped')
  })

  it('lists plan items with projectId query parameter', async () => {
    const planList = {
      items: [
        {
          id: 'plan_2',
          projectId: 'proj_9',
          keywordId: 'kw_2',
          plannedDate: '2024-05-02',
          title: 'Another Plan',
          outlineJson: [{ heading: 'Section', subpoints: [] }],
          status: 'planned',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ],
      nextCursor: 'cursor'
    }
    const fetchMock = vi.fn(async () => jsonResponse(planList))
    const client = new SeoAgentClient({ baseUrl, fetch: fetchMock })
    await client.listPlanItems('proj_9', { limit: 5 })

    const [url] = fetchMock.mock.calls[0]
    expect(String(url)).toContain('/api/plan-items')
    expect(String(url)).toContain('projectId=proj_9')
    expect(String(url)).toContain('limit=5')
  })

  it('sends keyword generation payload using domain schema', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ jobId: 'job_1' }, 202))
    const client = new SeoAgentClient({ baseUrl, fetch: fetchMock })
    await client.generateKeywords('proj_kw', { max: 50, includeGAds: true })

    const [, init] = fetchMock.mock.calls[0]
    const body = JSON.parse(init?.body as string)
    expect(body.projectId).toBe('proj_kw')
    expect(body.maxKeywords).toBe(50)
    expect(body.includeGAds).toBe(true)
  })

  it('enqueues article generation and publish jobs', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ jobId: 'gen', status: 'queued' }, 202))
      .mockResolvedValueOnce(jsonResponse({ jobId: 'pub', status: 'queued' }, 202))
    const client = new SeoAgentClient({ baseUrl, fetch: fetchMock })

    await client.generateArticle('plan_42')
    await client.publishArticle('article_7', 'integration_2')

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      new URL('/api/articles/generate', baseUrl),
      expect.objectContaining({ method: 'POST' })
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      new URL('/api/articles/article_7/publish', baseUrl),
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('validates integrations through the dedicated endpoint', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ status: 'ok', config: { targetUrl: 'https://example.com' } }))
    const client = new SeoAgentClient({ baseUrl, fetch: fetchMock })
    await client.validateIntegration({ type: 'webhook', config: { targetUrl: 'https://example.com', secret: 's' } })

    const [url, init] = fetchMock.mock.calls[0]
    expect(String(url)).toBe(`${baseUrl}/api/integrations/validate`)
    expect(init?.method).toBe('POST')
    const body = JSON.parse(init?.body as string)
    expect(body.type).toBe('webhook')
    expect(body.config.targetUrl).toBe('https://example.com')
  })
})
