import type { SerpProvider } from './interfaces/serp'
import type { ResearchProvider } from './interfaces/research'
import type { LlmProvider } from './interfaces/llm'
import type { KeywordIdeasProvider } from './interfaces/keyword-ideas'
import { config } from '@common/config'

import { dataForSeoSerp } from './impl/dataforseo/serp'
import { exaResearch } from './impl/exa/research'
import { openAiLlm } from './impl/openai/llm'
import { dataForSeoKeywordIdeasProvider } from './impl/dataforseo/keyword-ideas-provider'

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

export function getKeywordIdeasProvider(): KeywordIdeasProvider {
  // Only real provider supported
  return dataForSeoKeywordIdeasProvider
}
// Network tuning must run as early as possible
import '@common/infra/network'
