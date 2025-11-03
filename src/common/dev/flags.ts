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
    /** legacy removed: mockMode */
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

const legacyMockMode = false

const cachedFlags: DevFlags = {
  mocks: {
    // Single supported flag: MOCK_KEYWORD_GENERATOR
    crawl: false,
    llm: false,
    keywordExpansion: readBoolean('MOCK_KEYWORD_GENERATOR', false),
    metrics: false,
    serp: false
  },
  discovery: {
    mockMode: false,
    llmSeedsMax: 10,
    seedLimit: 20,
    keywordLimit: 100
  },
  ui: {
    devPanel: false
  }
}

export function getDevFlags(): DevFlags {
  return cachedFlags
}
