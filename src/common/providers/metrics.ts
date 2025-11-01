export type MetricInput = { phrase: string; locale?: string }
export type MetricResult = { phrase: string; metrics: { searchVolume?: number; difficulty?: number; cpc?: number; asOf?: string } }

export async function enrichMetrics(inputs: MetricInput[], locale: string, location?: string, projectId?: string): Promise<MetricResult[]> {
  // cache pass
  const { getMetric, setMetric } = await import('./metric-cache')
  const { getMetricDb, setMetricDb } = await import('./metric-cache-db')
  const cached: MetricResult[] = []
  const missing: MetricInput[] = []
  for (const i of inputs) {
    const mem = getMetric(i.phrase, locale, location, projectId)
    if (mem) {
      cached.push({ phrase: i.phrase, metrics: { ...mem, asOf: new Date().toISOString() } })
      continue
    }
    const dbm = await getMetricDb(i.phrase, locale, location, projectId)
    if (dbm) {
      cached.push({ phrase: i.phrase, metrics: { ...(dbm as any), asOf: new Date().toISOString() } })
      continue
    }
    missing.push(i)
  }

  // If DataForSEO creds available, try live enrichment for missing
  if (missing.length && process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD) {
    try {
      const { searchVolume } = await import('./dataforseo')
      const live = await searchVolume(missing.map((p) => ({ phrase: p.phrase, locale, location })))
      if (live.length) {
        for (const r of live) {
          const data = {
            searchVolume: r.metrics.searchVolume,
            cpc: r.metrics.cpc ?? undefined
          }
          setMetric(r.phrase, locale, location, data, projectId)
          await setMetricDb(r.phrase, data, locale, location, projectId)
        }
        const liveResults = live.map((r) => ({ phrase: r.phrase, metrics: { searchVolume: r.metrics.searchVolume, cpc: r.metrics.cpc, asOf: r.metrics.asOf ?? new Date().toISOString() } }))
        return [...cached, ...liveResults]
      }
    } catch {
      // fallthrough to pseudo
    }
  }
  // No creds or provider failed and stubs disabled → throw
  const { config } = await import('@common/config')
  if (!config.providers.allowStubs) {
    throw new Error('Metrics enrichment failed and stubs disabled')
  }
  // Fallback pseudo metrics (only when explicitly allowed)
  const pseudo = missing.map((i) => ({ phrase: i.phrase, metrics: pseudoMetrics(i.phrase) }))
  const { setMetric: setCached } = await import('./metric-cache')
  for (const p of pseudo) {
    setCached(p.phrase, locale, location, p.metrics, projectId)
    await setMetricDb(p.phrase, p.metrics, locale, location, projectId)
  }
  return [...cached, ...pseudo]
}

function pseudoMetrics(seed: string) {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  const volume = 100 + (hash % 5000)
  const difficulty = 10 + (hash % 70)
  const cpc = Number(((hash % 500) / 100).toFixed(2))
  return { searchVolume: volume, difficulty, cpc, asOf: new Date().toISOString() }
}
