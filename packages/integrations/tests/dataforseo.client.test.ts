import { describe, expect, it, vi } from 'vitest'
import { DataForSEOClient } from '../src/dataforseo/client.js'

const sampleResponse = {
  tasks: [
    {
      result: [
        {
          keyword_data: {
            keyword: 'growth marketing idea 1',
            search_volume: 880,
            cpc: 2.1,
            competition: 0.34,
            keyword_difficulty: 55,
            monthly_searches: [
              { year: 2024, month: 1, search_volume: 700 },
              { year: 2024, month: 2, search_volume: 720 }
            ]
          }
        }
      ]
    }
  ]
}

describe('DataForSEOClient', () => {
  it('chunks keyword requests and parses metrics', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => sampleResponse,
      text: async () => JSON.stringify(sampleResponse)
    })

    const client = new DataForSEOClient({
      login: 'user',
      password: 'pass',
      batchSize: 1,
      fetchImpl
    })

    const results = await client.fetchKeywordMetrics(['growth marketing idea 1'], 'English', 'United States')
    expect(fetchImpl).toHaveBeenCalled()
    const metric = results.get('growth marketing idea 1')
    expect(metric?.searchVolume).toBe(880)
    expect(metric?.trend12mo).toEqual([700, 720])
  })

  it('throws when credentials missing', async () => {
    const client = new DataForSEOClient()
    await expect(client.fetchKeywordMetrics(['keyword'], 'English')).rejects.toThrow('credentials')
  })
})
