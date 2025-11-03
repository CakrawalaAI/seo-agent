import type { KeywordMetricsProvider } from './interfaces/keyword-metrics'
import type { SerpProvider } from './interfaces/serp'
import type { ResearchProvider } from './interfaces/research'
import type { LlmProvider } from './interfaces/llm'
import type { KeywordExpandProvider } from './interfaces/keyword-expand'
import type { KeywordDiscoveryProvider } from './interfaces/keyword-discovery'
import { config } from '@common/config'

import { dataForSeoMetrics } from './impl/dataforseo/metrics'
import { dataForSeoSerp } from './impl/dataforseo/serp'
import { exaResearch } from './impl/exa/research'
import { openAiLlm } from './impl/openai/llm'
import { dataForSeoExpand } from './impl/dataforseo/expand'
import { dataForSeoDiscovery } from './impl/dataforseo/discovery'
import { mockDiscoveryProvider } from './impl/mock/discovery'
import { mockLlmProvider } from './impl/mock/llm'
import { mockSerpProvider } from './impl/mock/serp'
import { getDiscoveryOverride } from './overrides'
import { getDevFlags } from '@common/dev/flags'

export function getMetricsProvider(): KeywordMetricsProvider {
  switch ((config.providers.metrics || 'dataforseo').toLowerCase()) {
    default:
      return dataForSeoMetrics
  }
}

export function getSerpProvider(): SerpProvider {
  const flags = getDevFlags()
  if (flags.mocks.serp) return mockSerpProvider

  switch ((config.providers.serp || 'dataforseo').toLowerCase()) {
    default:
      return dataForSeoSerp
  }
}

export function getResearchProvider(): ResearchProvider {
  switch ((config.providers.research || 'exa').toLowerCase()) {
    default:
      return exaResearch
  }
}

export function getLlmProvider(): LlmProvider {
  const flags = getDevFlags()
  if (flags.mocks.llm) return mockLlmProvider

  switch ((config.providers.llm || 'openai').toLowerCase()) {
    default:
      return openAiLlm
  }
}

export function getExpandProvider(): KeywordExpandProvider {
  switch ((config.providers.expand || 'dataforseo').toLowerCase()) {
    default:
      return dataForSeoExpand
  }
}

export function getDiscoveryProvider(): KeywordDiscoveryProvider {
  const flags = getDevFlags()
  const override = getDiscoveryOverride()

  // Check atomic mock flag first
  if (flags.mocks.keywordExpansion) return mockDiscoveryProvider

  // Runtime overrides
  if (override === 'mock') return mockDiscoveryProvider
  if (override === 'dataforseo') return dataForSeoDiscovery

  // Legacy mockMode flag (backward compatibility)
  if (flags.discovery.mockMode) return mockDiscoveryProvider

  const name = String((config.providers as any).discovery || process.env.SEOA_PROVIDER_KEYWORD_DISCOVERY || 'dataforseo').toLowerCase()
  switch (name) {
    case 'mock':
      return mockDiscoveryProvider
    default:
      return dataForSeoDiscovery
  }
}
// Network tuning must run as early as possible
import '@common/infra/network'
