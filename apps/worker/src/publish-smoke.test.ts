// @ts-nocheck
import { describe, expect, it, vi } from 'vitest'

vi.mock('drizzle-orm', () => ({
  eq: () => ({}),
  and: () => ({}),
  inArray: () => ({}),
  sql: () => ({})
}))

vi.mock('@seo-agent/platform', () => ({
  getDb: () => ({}),
  schema: {},
  getJobQueue: () => ({
    on: () => {},
    enqueue: vi.fn(),
    reserveNext: vi.fn(),
    ready: Promise.resolve()
  }),
  appConfig: { worker: { pollIntervalMs: 10, maxAttempts: 3 } }
}))

const { runPublishJob } = await import('./index')

const createStubDb = (article, integration, updates) => {
  const schemaStub = {
    articles: {},
    integrations: {}
  }

  const select = vi.fn(() => ({
    from: (table) => ({
      where: () => ({
        limit: vi.fn().mockResolvedValue(table === schemaStub.articles ? [article] : [integration])
      })
    })
  }))

  const update = vi.fn((table) => ({
    set: (values) => {
      updates.push({ table, values })
      return {
        where: vi.fn().mockResolvedValue([])
      }
    }
  }))

  return { db: { select, update }, schema: schemaStub }
}

describe('runPublishJob', () => {
  it('delivers webhook jobs and records article state', async () => {
    const article = {
      id: 'article-1',
      projectId: 'project-1',
      title: 'Hello World',
      bodyHtml: '<article><p>Hello</p></article>',
      language: 'en-US',
      status: 'draft',
      cmsExternalId: null,
      url: null,
      publicationDate: null
    }

    const integration = {
      id: 'integration-1',
      type: 'webhook',
      config: { targetUrl: 'https://example.com/hook', secret: 'secret' }
    }

    const updates = []
    const logs: Array<{ message: string }> = []

    const { db, schema } = createStubDb(article, integration, updates)

    const deliverWebhookPublish = vi.fn().mockResolvedValue({
      externalId: 'ext-1',
      url: 'https://cms.example.com/item'
    })
    const publishArticleToWebflow = vi.fn()
    const updateJobProgress = vi.fn()
    const appendLog = vi.fn((jobId, message) => {
      logs.push({ jobId, message })
    })

    const job = { id: 'job-1', type: 'publish' }
    const payload = {
      projectId: 'project-1',
      articleId: 'article-1',
      integrationId: 'integration-1'
    }

    await runPublishJob(job, payload, {
      db,
      schema,
      deliverWebhookPublish,
      publishArticleToWebflow,
      appendLog,
      updateJobProgress
    })

    expect(deliverWebhookPublish).toHaveBeenCalledTimes(1)
    expect(deliverWebhookPublish.mock.calls[0][0]).toMatchObject({
      articleId: 'article-1',
      projectId: 'project-1',
      integrationId: 'integration-1',
      idempotencyKey: `publish:${payload.articleId}:${job.id}`
    })

    expect(updates).toHaveLength(1)
    expect(updates[0].values.status).toBe('published')
    expect(updates[0].values.cmsExternalId).toBe('ext-1')
    expect(updates[0].values.url).toBe('https://cms.example.com/item')
    expect(updateJobProgress).toHaveBeenCalledWith('job-1', 100)
    expect(logs.some((entry) => entry.message.includes('published via webhook'))).toBe(true)
  })
})
