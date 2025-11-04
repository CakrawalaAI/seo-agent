import { describe, it, expect, beforeEach } from 'vitest'
function resetEnv() {
  delete process.env.OPENAI_API_KEY
  delete process.env.DATAFORSEO_AUTH
}

describe('provider integration handling', () => {
  beforeEach(() => {
    resetEnv()
  })

  it('LLM provider throws when API key missing', async () => {
    const registry = await import('../../src/common/providers/registry')
    const llm = registry.getLlmProvider()
    await expect(
      llm.summarize([{ url: 'https://example.com', text: 'Example content' }])
    ).rejects.toThrow(/OPENAI_API_KEY missing/)
  })

  it('DataForSEO keyword ideas throws helpful error when credentials missing', async () => {
    const registry = await import('../../src/common/providers/registry')
    const keywordIdeas = registry.getKeywordIdeasProvider()
    await expect(
      keywordIdeas.keywordIdeas({ seeds: ['example'], language: 'en', locationCode: 2840, limit: 5 })
    ).rejects.toThrow(/DataForSEO credentials missing/)
  })
})
