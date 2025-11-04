export type MetricInput = { phrase: string; locale?: string }
export type MetricResult = { phrase: string; metrics: { searchVolume?: number; difficulty?: number; cpc?: number; asOf?: string } }

export async function enrichMetrics(inputs: MetricInput[], locale: string, location?: string, websiteId?: string): Promise<MetricResult[]> {
  // cache pass
  const { getMetric } = await import('./metric-cache')
  const { getMetricDb } = await import('./metric-cache-db')
  const cached: MetricResult[] = []
  const missing: MetricInput[] = []
  for (const i of inputs) {
    const mem = getMetric(i.phrase, locale, location, websiteId)
    if (mem) {
      cached.push({ phrase: i.phrase, metrics: { ...mem, asOf: new Date().toISOString() } })
      continue
    }
    const dbm = await getMetricDb(i.phrase, locale)
    if (dbm) {
      cached.push({ phrase: i.phrase, metrics: { ...(dbm as any), asOf: new Date().toISOString() } })
      continue
    }
    missing.push(i)
  }

  if (!missing.length) return cached

  throw new Error('Metrics enrichment provider unavailable (missing external credentials)')
}
