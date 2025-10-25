import OpenAI from 'openai'
import { MockLLMProvider } from './mock.js'
import { OpenAILLMProvider } from './openai.js'
import type { LLMProvider } from './types.js'

export type LLMProviderName = 'openai' | 'mock'

export type LLMProviderOptions = {
  provider?: LLMProviderName
  apiKey?: string
  model?: string
}

const resolveProviderName = (options?: LLMProviderOptions): LLMProviderName => {
  if (options?.provider) return options.provider
  if (process.env.LLM_PROVIDER === 'openai' || process.env.OPENAI_API_KEY) return 'openai'
  return 'mock'
}

export const createLLMProvider = (options?: LLMProviderOptions): LLMProvider => {
  const providerName = resolveProviderName(options)
  if (providerName === 'openai') {
    const apiKey = options?.apiKey ?? process.env.OPENAI_API_KEY
    if (!apiKey) {
      console.warn('[integrations] OPENAI_API_KEY missing, falling back to mock provider')
      return new MockLLMProvider()
    }
    const client = new OpenAI({ apiKey })
    return new OpenAILLMProvider(client, options?.model ?? process.env.OPENAI_MODEL)
  }
  return new MockLLMProvider()
}

export { MockLLMProvider, OpenAILLMProvider }
