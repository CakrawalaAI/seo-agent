import { describe, it, expect, beforeEach } from 'vitest'
import { config } from '../../src/common/config'

function resetEnv() {
  delete process.env.SEOA_ALLOW_PROVIDER_STUBS
  delete process.env.OPENAI_API_KEY
  delete process.env.DATAFORSEO_AUTH
}

describe('provider integration handling', () => {
  beforeEach(() => {
    resetEnv()
    config.providers.allowStubs = false
  })

  it('LLM provider falls back to stub when stubs enabled', async () => {
    process.env.SEOA_ALLOW_PROVIDER_STUBS = '1'
    config.providers.allowStubs = true
    const registry = await import('../../src/common/providers/registry')
    const llm = registry.getLlmProvider()
    const summary = await llm.summarize([{ url: 'https://example.com', text: 'Example content' }])
    expect(summary.businessSummary).toContain('stub')
  })

  it('DataForSEO discovery throws helpful error when credentials missing', async () => {
    process.env.SEOA_ALLOW_PROVIDER_STUBS = '0'
    config.providers.allowStubs = false
    const registry = await import('../../src/common/providers/registry')
    const discovery = registry.getDiscoveryProvider()
    await expect(
      discovery.keywordsForSite({ domain: 'example.com', language: 'en-US', locationCode: 2840, limit: 5 })
    ).rejects.toThrow(/DataForSEO credentials missing/)
  })
})
