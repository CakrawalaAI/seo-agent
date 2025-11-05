const readEnv = (key: string): string | undefined => {
  if (typeof process !== 'undefined' && process.env && process.env[key] !== undefined) {
    return String(process.env[key])
  }
  return undefined
}

const readNumber = (key: string, fallback: number): number => {
  const raw = readEnv(key)
  if (raw === undefined) return fallback
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const readString = <T extends string>(key: string, fallback: T, allowed?: readonly T[]): T => {
  const raw = readEnv(key)
  if (!raw) return fallback
  const normalized = raw.toLowerCase() as T
  if (allowed && !allowed.includes(normalized)) return fallback
  return normalized
}

const readNonNegative = (key: string, fallback: number): number => {
  const raw = readEnv(key)
  if (raw === undefined) return fallback
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

const readPositiveInt = (key: string, fallback: number, max?: number): number => {
  const raw = readEnv(key)
  if (raw === undefined) return fallback
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  const normalized = Math.floor(parsed)
  if (max !== undefined) return Math.min(max, normalized)
  return normalized
}

const readBoolean = (key: string, fallback: boolean): boolean => {
  const raw = readEnv(key)
  if (raw === undefined) return fallback
  const normalized = raw.trim().toLowerCase()
  if (!normalized) return fallback
  if (['1', 'true', 'yes', 'y', 'on', 'enable', 'enabled'].includes(normalized)) return true
  if (['0', 'false', 'no', 'n', 'off', 'disable', 'disabled'].includes(normalized)) return false
  return fallback
}

import type { ArticleFeatureFlags } from '@entities/article/domain/article'

// Minimal, flag-aware runtime defaults
export const env: {
  publicationAllowed: string[]
  autopublishPolicy: 'buffered'
  bufferDays: number
  crawlBudgetPages: number
  crawlMaxDepth: number
  crawlRender: 'playwright' | 'fetch'
  crawlCooldownHours: number
  crawlConcurrency: number
  crawlAllowSubdomains: boolean
  crawlExcludePaths?: string[]
  summaryTokenBudget: number
  realtimePort: number
  realtimeEndpoint: string | null
  realtimeDisableServer: boolean
  blobTtlDays: number
  competitorFetchFallback: boolean
  keywordRegenerateCooldownHours: number
  externalRetryAttempts: number
  keywordAutoIncludeLimit: number
  articleFeatures: ArticleFeatureFlags
} = {
  publicationAllowed: ['webhook'],
  autopublishPolicy: 'buffered',
  bufferDays: 3,
  crawlBudgetPages: readNumber('MAX_PAGES_CRAWLED', 50),
  crawlMaxDepth: readNumber('MAX_CRAWL_DEPTH', 2),
  crawlRender: readString<'playwright' | 'fetch'>('CRAWL_RENDER', 'playwright', ['playwright', 'fetch']),
  crawlCooldownHours: readNonNegative('CRAWL_COOLDOWN_HOURS', 24),
  crawlConcurrency: readPositiveInt('MAX_CRAWL_CONCURRENCY', 6, 32),
  crawlAllowSubdomains: readBoolean('CRAWL_ALLOW_SUBDOMAINS', true),
  crawlExcludePaths: (readEnv('CRAWL_EXCLUDE') || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  summaryTokenBudget: readNumber('SUMMARY_TOKEN_BUDGET', 60000),
  realtimePort: readNumber('SEOA_REALTIME_PORT', 4173),
  realtimeEndpoint: readEnv('SEOA_REALTIME_ENDPOINT') || null,
  realtimeDisableServer: (readEnv('SEOA_REALTIME_DISABLE_SERVER') || '0') === '1',
  blobTtlDays: readNumber('BLOB_TTL_DAYS', 30),
  competitorFetchFallback: true,
  keywordRegenerateCooldownHours: readNonNegative('GENERATE_KEYWORD_COOLDOWN_HOURS', 24),
  externalRetryAttempts: readPositiveInt('MAX_RETRY_ATTEMPTS', 3, 10),
  keywordAutoIncludeLimit: readPositiveInt('NUM_ACTIVE_KEYWORDS', 30, 1000),
  articleFeatures: {
    serp: readBoolean('ENABLE_ARTICLE_SERP', true),
    youtube: readBoolean('ENABLE_ARTICLE_YOUTUBE', true),
    imageUnsplash: readBoolean('ENABLE_ARTICLE_IMAGE_UNSPLASH', true),
    imageAi: readBoolean('ENABLE_ARTICLE_IMAGE_AI', false),
    research: readBoolean('ENABLE_ARTICLE_RESEARCH', true),
    attachments: readBoolean('ENABLE_ARTICLE_ATTACHMENTS', true)
  }
}
