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

export function getMetricsProvider(): KeywordMetricsProvider {
  switch ((config.providers.metrics || 'dataforseo').toLowerCase()) {
    default:
      return dataForSeoMetrics
  }
}

export function getSerpProvider(): SerpProvider {
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
  const name = String((config.providers as any).discovery || process.env.SEOA_PROVIDER_KEYWORD_DISCOVERY || 'dataforseo').toLowerCase()
  switch (name) {
    default:
      return dataForSeoDiscovery
  }
}
// Network tuning must run as early as possible
import '@common/infra/network'
