type Key = string
type Entry = { metrics: { searchVolume?: number; difficulty?: number; cpc?: number }; expiresAt: number }

const store = new Map<Key, Entry>()

function keyOf(phrase: string, locale?: string, location?: string, projectId?: string) {
  return `${projectId ?? ''}|${phrase.toLowerCase()}|${locale ?? ''}|${location ?? ''}`
}

export function getMetric(phrase: string, locale?: string, location?: string, projectId?: string) {
  const k = keyOf(phrase, locale, location, projectId)
  const e = store.get(k)
  if (!e) return null
  if (Date.now() > e.expiresAt) {
    store.delete(k)
    return null
  }
  return e.metrics
}

export function setMetric(
  phrase: string,
  locale: string | undefined,
  location: string | undefined,
  metrics: { searchVolume?: number; difficulty?: number; cpc?: number },
  projectId?: string,
  ttlMs = 1000 * 60 * 60 * 24 * 7
) {
  const k = keyOf(phrase, locale, location, projectId)
  store.set(k, { metrics, expiresAt: Date.now() + Math.max(60_000, ttlMs) })
}
