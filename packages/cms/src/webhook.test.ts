// @ts-nocheck
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHmac } from 'node:crypto'
import { deliverWebhookPublish } from './webhook'

const TARGET_URL = 'https://example.com/webhook'

const buildPayload = () => ({
  targetUrl: TARGET_URL,
  secret: 'shhh',
  article: {
    title: 'Test',
    bodyHtml: '<p>Hi</p>'
  },
  articleId: 'article-1',
  projectId: 'proj-1',
  integrationId: 'int-1'
})

beforeEach(() => {
  vi.useRealTimers()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('deliverWebhookPublish', () => {
  it('sends signed payloads and returns response metadata', async () => {
    const payload = buildPayload()
    const expectedBody = JSON.stringify({
      article: payload.article,
      articleId: payload.articleId,
      projectId: payload.projectId,
      integrationId: payload.integrationId,
      event: 'article.publish'
    })
    const signature = createHmac('sha256', payload.secret).update(expectedBody).digest('hex')

    const responseJson = { externalId: 'ext-1', url: 'https://cms.test/item' }
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify(responseJson), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      )

    const result = await deliverWebhookPublish(payload)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [, init] = fetchMock.mock.calls[0]
    expect(init?.method).toBe('POST')
    expect(init?.body).toBe(expectedBody)
    expect(init?.headers).toMatchObject({
      'content-type': 'application/json',
      'X-SEOA-Signature': signature,
      'X-SEOA-Idempotency': `article:${payload.articleId}`,
      'X-SEOA-Event': 'article.publish'
    })
    expect(result).toEqual({ externalId: 'ext-1', url: 'https://cms.test/item', raw: responseJson })
  })

  it('retries failed deliveries before succeeding', async () => {
    const payload = buildPayload()

    const fetchMock = vi.spyOn(globalThis, 'fetch')
    fetchMock
      .mockResolvedValueOnce(new Response('nope', { status: 500, statusText: 'error' }))
      .mockResolvedValueOnce(new Response('again', { status: 502, statusText: 'bad gateway' }))
      .mockResolvedValueOnce(
        new Response('{}', {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      )

    const result = await deliverWebhookPublish(payload)

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(result.raw).toEqual({})
    expect(result.externalId).toBeUndefined()
    expect(result.url).toBeUndefined()
  })

  it('throws after exhausting retries', async () => {
    const payload = buildPayload()

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('nope', { status: 503, statusText: 'unavailable' })
    )

    await expect(deliverWebhookPublish(payload)).rejects.toThrow(/Webhook publish failed/)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
})
