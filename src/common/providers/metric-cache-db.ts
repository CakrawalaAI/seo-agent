import { metricCache } from '@entities/metrics/db/schema'
import { getDb, hasDatabase } from '@common/infra/db'

function hashKey(phrase: string, locale?: string, location?: string, projectId?: string) {
  const key = `${projectId ?? ''}|${phrase.toLowerCase()}|${locale ?? ''}|${location ?? ''}`
  try {
    const crypto = require('node:crypto') as typeof import('node:crypto')
    return crypto.createHash('sha1').update(key).digest('hex')
  } catch {
    return key
  }
}

export async function getMetricDb(phrase: string, locale?: string, location?: string, projectId?: string) {
  if (!hasDatabase()) return null
  try {
    const db = getDb()
    const hash = hashKey(phrase, locale, location, projectId)
    // @ts-ignore
    const rows = await (db.select().from(metricCache).where((metricCache as any).hash.eq(hash)).limit(1) as any)
    const row = Array.isArray(rows) ? rows[0] : null
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
  metrics: { searchVolume?: number; difficulty?: number; cpc?: number },
  locale?: string,
  location?: string,
  projectId?: string,
  ttlSeconds = 7 * 24 * 60 * 60,
  provider = 'dataforseo'
) {
  if (!hasDatabase()) return false
  try {
    const db = getDb()
    const id = `mc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
    const hash = hashKey(phrase, locale, location, projectId)
    // upsert on (provider, hash)
    // @ts-ignore
    await db
      .insert(metricCache)
      .values({ id, provider, hash, projectId: projectId ?? null, metricsJson: metrics, fetchedAt: new Date() as any, ttlSeconds })
      .onConflictDoUpdate({
        target: [metricCache.provider, metricCache.hash],
        set: { metricsJson: metrics, fetchedAt: new Date() as any, ttlSeconds, projectId: projectId ?? null }
      })
    return true
  } catch {
    return false
  }
}
