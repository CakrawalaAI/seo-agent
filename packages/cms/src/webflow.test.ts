// @ts-nocheck
import { afterEach, describe, expect, it, vi } from 'vitest'
import { publishArticleToWebflow } from './webflow'

const baseArticle = {
  title: 'Launch Post',
  excerpt: 'Hello world',
  bodyHtml: '<article><p>Hello</p></article>',
  slug: 'launch-post',
  seo: {
    metaTitle: 'Launch Post',
    metaDescription: 'Hello world'
  },
  media: {
    images: [
      {
        src: 'https://cdn.example.com/image.jpg',
        alt: 'Cover'
      }
    ]
  },
  tags: ['launch', 'news']
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('publishArticleToWebflow', () => {
  it('creates draft items with mapped fields', async () => {
    const config = {
      accessToken: 'token',
      collectionId: 'collection-1',
      fieldMapping: {
        name: 'name',
        slug: 'slug',
        body: 'body',
        excerpt: 'summary',
        seoTitle: 'seo_title',
        seoDescription: 'seo_description',
        tags: 'tags',
        mainImage: 'main_image'
      },
      publishMode: 'draft'
    }

    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            item: { id: 'item-1', slug: 'launch-post', url: 'https://webflow/item' }
          }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' }
          }
        )
      )

    const result = await publishArticleToWebflow(config, baseArticle)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.webflow.com/v2/collections/collection-1/items')
    expect(init?.method).toBe('POST')
    const body = JSON.parse(init?.body as string)
    expect(body.isDraft).toBe(true)
    expect(body.fieldData).toMatchObject({
      name: 'Launch Post',
      slug: 'launch-post',
      body: '<article><p>Hello</p></article>',
      summary: 'Hello world',
      seo_title: 'Launch Post',
      seo_description: 'Hello world',
      tags: ['launch', 'news'],
      main_image: 'https://cdn.example.com/image.jpg'
    })
    expect(result).toEqual({ itemId: 'item-1', slug: 'launch-post', url: 'https://webflow/item' })
  })

  it('publishes live items with locale and slug fallback', async () => {
    const config = {
      accessToken: 'token',
      collectionId: 'collection-2',
      fieldMapping: {
        name: 'name',
        slug: 'slug',
        body: 'body'
      },
      publishMode: 'live',
      cmsLocaleId: 'en-global'
    }

    const article = {
      ...baseArticle,
      slug: undefined,
      title: 'Long Title for Launch Feature'
    }

    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(
          JSON.stringify({ id: 'item-9', slug: 'long-title-for-launch-feature' }),
          {
            status: 200,
            headers: { 'content-type': 'application/json' }
          }
        )
      )

    const result = await publishArticleToWebflow(config, article)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.webflow.com/v2/collections/collection-2/items/live')
    const payload = JSON.parse(init?.body as string)
    expect(payload.isDraft).toBe(false)
    expect(payload.cmsLocaleIds).toEqual(['en-global'])
    expect(payload.fieldData.slug).toMatch(/^long-title-for-launch-feature/)
    expect(result.itemId).toBe('item-9')
    expect(result.slug).toMatch(/^long-title-for-launch-feature/)
  })
})
