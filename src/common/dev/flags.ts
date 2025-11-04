/// <reference types="vite/client" />

function readEnv(key: string): string | undefined {
  if (typeof process !== 'undefined' && process.env) {
    const value = process.env[key]
    return typeof value === 'string' ? value : undefined
  }
  return undefined
}

function readNumber(key: string, defaultValue: number): number {
  const raw = readEnv(key)
  if (raw === undefined) return defaultValue
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : defaultValue
}

export const keywordConfig = {
  llmSeedsMax: Math.max(1, readNumber('KEYWORD_LLM_SEEDS_MAX', 10)),
  seedLimit: Math.max(1, readNumber('MAX_SEED_KEYWORDS', 10)),
  keywordLimit: Math.max(1, readNumber('MAX_KEYWORDS_GENERATE', 10))
}
