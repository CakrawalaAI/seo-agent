/// <reference types="vite/client" />

function readEnv(key: string): string | undefined {
  if (typeof process !== 'undefined' && process.env && process.env[key] !== undefined) {
    return process.env[key]
  }
  const meta: Record<string, unknown> | undefined =
    typeof import.meta !== 'undefined' && (import.meta as any)?.env ? ((import.meta as any).env as Record<string, unknown>) : undefined
  const value = meta?.[key]
  return typeof value === 'string' ? value : undefined
}

function readNumber(key: string, defaultValue: number): number {
  const raw = readEnv(key)
  if (raw === undefined) return defaultValue
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : defaultValue
}

export const keywordConfig = {
  llmSeedsMax: Math.max(1, readNumber('KEYWORD_LLM_SEEDS_MAX', 10)),
  seedLimit: Math.max(1, readNumber('KEYWORD_SEED_LIMIT', 20)),
  keywordLimit: Math.max(1, readNumber('KEYWORD_IDEA_LIMIT', 100))
}
