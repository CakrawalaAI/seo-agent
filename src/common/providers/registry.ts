import type { SerpProvider } from './interfaces/serp'
import type { ResearchProvider } from './interfaces/research'
import type { LlmProvider } from './interfaces/llm'
import type { KeywordIdeasProvider } from './interfaces/keyword-ideas'
import { config } from '@common/config'

import { dataForSeoSerp } from './impl/dataforseo/serp'
import { exaResearch } from './impl/exa/research'
import { openAiLlm } from './impl/openai/llm'
import { dataForSeoKeywordIdeasProvider } from './impl/dataforseo/keyword-ideas-provider'
import { mockKeywordIdeasProvider } from './impl/mock/keyword-ideas'
import { mockSerpProvider } from './impl/mock/serp'
import { getKeywordIdeasOverride } from './overrides'

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
  const override = getKeywordIdeasOverride()

  // Check atomic mock flag first
  if (String(process.env.MOCK_KEYWORD_GENERATOR || '').trim().toLowerCase() === 'true') return mockKeywordIdeasProvider

  // Runtime overrides
  if (override === 'mock') return mockKeywordIdeasProvider
  if (override === 'dataforseo') return dataForSeoKeywordIdeasProvider

  const name = String((config.providers as any).keywordIdeas || 'dataforseo').toLowerCase()
  switch (name) {
    case 'mock':
      return mockKeywordIdeasProvider
    default:
      return dataForSeoKeywordIdeasProvider
  }
}
// Network tuning must run as early as possible
import '@common/infra/network'
