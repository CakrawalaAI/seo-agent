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

// Minimal, flag-aware runtime defaults
export const env = {
  publicationAllowed: ['webhook'],
  autopublishPolicy: 'buffered',
  bufferDays: 3,
  crawlBudgetPages: readNumber('MAX_PAGES_CRAWLED', 50),
  crawlMaxDepth: readNumber('MAX_CRAWL_DEPTH', 2),
  crawlRender: readString<'playwright' | 'fetch'>('CRAWL_RENDER', 'playwright', ['playwright', 'fetch']),
  blobTtlDays: readNumber('BLOB_TTL_DAYS', 30),
  competitorFetchFallback: true,
}
