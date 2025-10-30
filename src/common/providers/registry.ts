import type { KeywordMetricsProvider } from './interfaces/keyword-metrics'
import type { SerpProvider } from './interfaces/serp'
import type { ResearchProvider } from './interfaces/research'
import type { LlmProvider } from './interfaces/llm'
import type { KeywordExpandProvider } from './interfaces/keyword-expand'

import { dataForSeoMetrics } from './impl/dataforseo/metrics'
import { dataForSeoSerp } from './impl/dataforseo/serp'
import { exaResearch } from './impl/exa/research'
import { openAiLlm } from './impl/openai/llm'
import { dataForSeoExpand } from './impl/dataforseo/expand'

export function getMetricsProvider(): KeywordMetricsProvider {
  switch ((process.env.SEOA_PROVIDER_METRICS || 'dataforseo').toLowerCase()) {
    default:
      return dataForSeoMetrics
  }
}

export function getSerpProvider(): SerpProvider {
  switch ((process.env.SEOA_PROVIDER_SERP || 'dataforseo').toLowerCase()) {
    default:
      return dataForSeoSerp
  }
}

export function getResearchProvider(): ResearchProvider {
  switch ((process.env.SEOA_PROVIDER_RESEARCH || 'exa').toLowerCase()) {
    default:
      return exaResearch
  }
}

export function getLlmProvider(): LlmProvider {
  switch ((process.env.SEOA_PROVIDER_LLM || 'openai').toLowerCase()) {
    default:
      return openAiLlm
  }
}

export function getExpandProvider(): KeywordExpandProvider {
  switch ((process.env.SEOA_PROVIDER_EXPAND || 'dataforseo').toLowerCase()) {
    default:
      return dataForSeoExpand
  }
}
