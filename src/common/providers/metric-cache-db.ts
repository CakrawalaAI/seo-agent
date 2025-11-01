import { metricCache } from '@entities/metrics/db/schema'
import { keywordCanon } from '@entities/keyword/db/schema.canon'
import { getDb, hasDatabase } from '@common/infra/db'
import { eq } from 'drizzle-orm'

export async function getMetricDb(phrase: string, locale = 'en-US') {
  if (!hasDatabase()) return null
  try {
    const db = getDb()
    const phraseNorm = normalizePhrase(phrase)
    const canonId = canonIdFor(phraseNorm, locale)
    const rows = await db.select().from(metricCache).where(eq(metricCache.canonId, canonId)).limit(1)
    const row = rows?.[0]
    if (!row) return null
    const ttl = Number(row.ttlSeconds ?? 0)
    const fetchedAt = row.fetchedAt ? new Date(row.fetchedAt) : null
    if (ttl > 0 && fetchedAt && Date.now() - fetchedAt.getTime() > ttl * 1000) {
      return null
    }
    return row.metricsJson as Record<string, unknown> | null
  } catch {
    return null
  }
}

export async function setMetricDb(
  phrase: string,
  metrics: { searchVolume?: number; difficulty?: number; cpc?: number; competition?: number; rankability?: number } | null,
  locale = 'en-US',
  ttlSeconds = 30 * 24 * 60 * 60,
  provider = 'dataforseo'
) {
  if (!hasDatabase()) return false
  try {
    const db = getDb()
    const phraseNorm = normalizePhrase(phrase)
    const canonId = canonIdFor(phraseNorm, locale)
    await db
      .insert(keywordCanon)
      .values({ id: canonId, phraseNorm, languageCode: locale })
      .onConflictDoNothing?.()
    await db
      .insert(metricCache)
      .values({ id: genId('mcache'), canonId, provider, metricsJson: metrics as any, ttlSeconds, fetchedAt: new Date() as any })
      .onConflictDoUpdate({
        target: [metricCache.canonId],
        set: { metricsJson: metrics as any, fetchedAt: new Date() as any, ttlSeconds }
      })
    return true
  } catch {
    return false
  }
}

function normalizePhrase(raw: string) {
  return raw.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase()
}

function canonIdFor(phraseNorm: string, language: string) {
  return `kcan_${Buffer.from(`${phraseNorm}|${language}`).toString('base64').slice(0, 20)}`
}

function genId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}
