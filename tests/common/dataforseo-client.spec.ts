import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { dfsClient } from '../../src/common/providers/impl/dataforseo/client'
import { DATAFORSEO_DEFAULT_LOCATION_CODE, DATAFORSEO_DEFAULT_LANGUAGE_CODE } from '../../src/common/providers/impl/dataforseo/geo'

const ok = (body: unknown) => ({
  ok: true,
  status: 200,
  text: async () => JSON.stringify(body)
}) as any

describe('dfsClient endpoints', () => {
  let fetchSpy: ReturnType<typeof vi.fn>
  let originalFetch: typeof fetch | undefined

  beforeEach(() => {
    process.env.DATAFORSEO_AUTH = Buffer.from('user@example.com:secret').toString('base64')
    fetchSpy = vi.fn()
    originalFetch = globalThis.fetch
    ;(globalThis as any).fetch = fetchSpy
  })

  afterEach(() => {
    delete process.env.DATAFORSEO_AUTH
    if (originalFetch) {
      ;(globalThis as any).fetch = originalFetch
    } else {
      delete (globalThis as any).fetch
    }
  })

  it('keywordOverview posts tasks per keyword', async () => {
    fetchSpy.mockResolvedValueOnce(ok({ tasks: [{ data: [{ keyword: 'prep interview' }], result: [{ keyword: 'prep interview', keyword_info: { search_volume: 120 } }] }] }))
    const map = await dfsClient.keywordOverview({ keywords: ['prep interview'], languageCode: 'en-US', locationCode: DATAFORSEO_DEFAULT_LOCATION_CODE })
    const [url, init] = fetchSpy.mock.calls.at(-1) as [string, any]
    expect(url).toBe('https://api.dataforseo.com/v3/dataforseo_labs/google/keyword_overview/live')
    const payload = JSON.parse(init.body)
    expect(Array.isArray(payload)).toBe(true)
    expect(payload[0]).toMatchObject({ keywords: ['prep interview'], location_code: DATAFORSEO_DEFAULT_LOCATION_CODE })
    expect(map.get('prep interview')).toMatchObject({ search_volume: 120 })
  })

  it('searchVolume batches keywords with defaults', async () => {
    fetchSpy.mockResolvedValueOnce(ok({ tasks: [{ result: [{ items: [{ keyword: 'case interview', search_volume: 200, cpc: 1.2 }] }] }] }))
    const rows = await dfsClient.searchVolume({ keywords: ['case interview'], languageCode: DATAFORSEO_DEFAULT_LANGUAGE_CODE, locationCode: DATAFORSEO_DEFAULT_LOCATION_CODE })
    const [url, init] = fetchSpy.mock.calls.at(-1) as [string, any]
    expect(url).toBe('https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live')
    const payload = JSON.parse(init.body)
    expect(payload[0]).toMatchObject({ keywords: ['case interview'], language_name: 'English' })
    expect(rows[0]).toMatchObject({ keyword: 'case interview', metrics: { searchVolume: 200, cpc: 1.2 } })
  })

  it('keywordsForKeywords posts array payload', async () => {
    fetchSpy.mockResolvedValueOnce(ok({ tasks: [{ result: [{ items: [{ keyword: 'consulting prep' }] }] }] }))
    const rows = await dfsClient.keywordsForKeywords({ keywords: ['consulting'], languageCode: 'en-US', locationCode: DATAFORSEO_DEFAULT_LOCATION_CODE })
    const [url, init] = fetchSpy.mock.calls.at(-1) as [string, any]
    expect(url).toBe('https://api.dataforseo.com/v3/keywords_data/google_ads/keywords_for_keywords/live')
    expect(init.body).toContain('consulting')
    expect(rows[0]).toBe('consulting prep')
  })

  it('keywordsForSite posts target domain', async () => {
    fetchSpy.mockResolvedValueOnce(ok({ tasks: [{ result: [{ items: [{ keyword: 'case interview practice' }] }] }] }))
    const rows = await dfsClient.keywordsForSite({ target: 'prepinterview.ai', languageCode: 'en', locationCode: DATAFORSEO_DEFAULT_LOCATION_CODE })
    const [url, init] = fetchSpy.mock.calls.at(-1) as [string, any]
    expect(url).toBe('https://api.dataforseo.com/v3/dataforseo_labs/google/keywords_for_site/live')
    expect(init.body).toContain('prepinterview.ai')
    expect(rows[0]).toBe('case interview practice')
  })

  it('relatedKeywords accepts multiple seeds', async () => {
    fetchSpy.mockResolvedValueOnce(ok({ tasks: [{ result: [{ items: [{ keyword: 'consulting interview tips' }] }] }] }))
    const rows = await dfsClient.relatedKeywords({ keywords: ['consulting interview'], languageCode: 'en', locationCode: DATAFORSEO_DEFAULT_LOCATION_CODE })
    const [url, init] = fetchSpy.mock.calls.at(-1) as [string, any]
    expect(url).toBe('https://api.dataforseo.com/v3/dataforseo_labs/google/related_keywords/live')
    expect(init.body).toContain('consulting interview')
    expect(rows[0]).toBe('consulting interview tips')
  })

  it('keywordIdeas hits keyword_ideas endpoint', async () => {
    fetchSpy.mockResolvedValueOnce(ok({ tasks: [{ result: [{ items: [{ keyword: 'case interview example' }] }] }] }))
    const rows = await dfsClient.keywordIdeas({ keywords: ['case interview'], languageCode: 'en', locationCode: DATAFORSEO_DEFAULT_LOCATION_CODE })
    const [url, init] = fetchSpy.mock.calls.at(-1) as [string, any]
    expect(url).toBe('https://api.dataforseo.com/v3/dataforseo_labs/google/keyword_ideas/live')
    expect(init.body).toContain('case interview')
    expect(rows[0]).toBe('case interview example')
  })

  it('bulkKeywordDifficulty returns difficulty map', async () => {
    fetchSpy.mockResolvedValueOnce(ok({ tasks: [{ result: [{ items: [{ keyword: 'consulting interview', keyword_difficulty: 47 }] }] }] }))
    const map = await dfsClient.bulkKeywordDifficulty({ keywords: ['consulting interview'], languageCode: 'en', locationCode: DATAFORSEO_DEFAULT_LOCATION_CODE })
    const [url, init] = fetchSpy.mock.calls.at(-1) as [string, any]
    expect(url).toBe('https://api.dataforseo.com/v3/dataforseo_labs/google/bulk_keyword_difficulty/live')
    expect(init.body).toContain('consulting interview')
    expect(map.get('consulting interview')).toBe(47)
  })

  it('keywordSuggestions posts single keyword task', async () => {
    fetchSpy.mockResolvedValueOnce(ok({ tasks: [{ result: [{ items: [{ keyword: 'case interview tips' }] }] }] }))
    const rows = await dfsClient.keywordSuggestions({ keyword: 'case interview', languageCode: 'en', locationCode: DATAFORSEO_DEFAULT_LOCATION_CODE })
    const [url, init] = fetchSpy.mock.calls.at(-1) as [string, any]
    expect(url).toBe('https://api.dataforseo.com/v3/dataforseo_labs/google/keyword_suggestions/live')
    expect(init.body).toContain('case interview')
    expect(rows[0]).toBe('case interview tips')
  })

  it('serpOrganic posts proper payload', async () => {
    fetchSpy.mockResolvedValueOnce(ok({ tasks: [{ result: [{ items: [{ rank_group: 1, url: 'https://example.com' }] }] }] }))
    const rows = await dfsClient.serpOrganic({ keyword: 'case interview', languageCode: 'en', locationCode: DATAFORSEO_DEFAULT_LOCATION_CODE })
    const [url, init] = fetchSpy.mock.calls.at(-1) as [string, any]
    expect(url).toBe('https://api.dataforseo.com/v3/serp/google/organic/live/regular')
    expect(init.body).toContain('case interview')
    expect(rows[0]?.url).toBe('https://example.com')
  })
})
