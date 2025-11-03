/// <reference types="vite/client" />

type DevFlags = {
  /** Atomic mock flags for composable testing */
  mocks: {
    crawl: boolean
    llm: boolean
    keywordExpansion: boolean
    metrics: boolean
    serp: boolean
  }
  /** Discovery pipeline configuration */
  discovery: {
    /** @deprecated Use mocks.* flags instead. Enables all discovery-related mocks for backward compatibility */
    mockMode: boolean
    llmSeedsMax: number
    seedLimit: number
    keywordLimit: number
  }
  ui: {
    devPanel: boolean
  }
}

function readEnv(key: string): string | undefined {
  if (typeof process !== 'undefined' && process.env && process.env[key] !== undefined) {
    return process.env[key]
  }
  const meta: Record<string, unknown> | undefined =
    typeof import.meta !== 'undefined' && (import.meta as any)?.env ? ((import.meta as any).env as Record<string, unknown>) : undefined
  const value = meta?.[key]
  return typeof value === 'string' ? value : undefined
}

function readBoolean(key: string, defaultValue = false): boolean {
  const raw = readEnv(key)
  if (raw === undefined) return defaultValue
  const normalized = raw.trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false
  return defaultValue
}

function readNumber(key: string, defaultValue: number): number {
  const raw = readEnv(key)
  if (raw === undefined) return defaultValue
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : defaultValue
}

const legacyMockMode = readBoolean('SEOA_DISCOVERY_MOCK_MODE', false)

const cachedFlags: DevFlags = {
  mocks: {
    // Individual atomic flags with legacy fallback
    crawl: readBoolean('SEOA_MOCK_CRAWL', legacyMockMode),
    llm: readBoolean('SEOA_MOCK_LLM', legacyMockMode),
    keywordExpansion: readBoolean('SEOA_MOCK_KEYWORD_EXPANSION', legacyMockMode),
    metrics: readBoolean('SEOA_MOCK_METRICS', legacyMockMode),
    serp: readBoolean('SEOA_MOCK_SERP', legacyMockMode)
  },
  discovery: {
    mockMode: legacyMockMode,
    llmSeedsMax: Math.max(1, readNumber('SEOA_DISCOVERY_LLM_SEEDS_MAX', 10)),
    seedLimit: Math.max(1, readNumber('SEOA_DISCOVERY_SEED_LIMIT', 20)),
    keywordLimit: Math.max(1, readNumber('SEOA_DISCOVERY_KEYWORD_LIMIT', 100))
  },
  ui: {
    devPanel: readBoolean('SEOA_DEV_PANEL', false)
  }
}

export function getDevFlags(): DevFlags {
  return cachedFlags
}

