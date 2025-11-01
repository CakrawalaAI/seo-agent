import { getDiscoveryProvider } from '@common/providers/registry'

export async function discoverKeywords(input: {
  siteUrl?: string | null
  seeds: string[]
  language: string
  locationCode: number
  baselineLimit?: number
  relatedLimit?: number
  ideasLimit?: number
}): Promise<string[]> {
  const prov = getDiscoveryProvider()
  const all: string[] = []
  const seen = new Set<string>()

  // Baseline: keywords for site (existing rankings)
  if (input.siteUrl) {
    try {
      const u = new URL(input.siteUrl)
      const domain = u.hostname
      const base = await prov.keywordsForSite({ domain, language: input.language, locationCode: input.locationCode, limit: input.baselineLimit ?? 500 })
      for (const r of base) { const k = r.phrase.toLowerCase(); if (!seen.has(k)) { seen.add(k); all.push(r.phrase) } }
    } catch {}
  }

  // Expansion: related keywords
  try {
    const rel = await prov.relatedKeywords({ seeds: input.seeds.slice(0, 20), language: input.language, locationCode: input.locationCode, limit: input.relatedLimit ?? 2000 })
    for (const r of rel) { const k = r.phrase.toLowerCase(); if (!seen.has(k)) { seen.add(k); all.push(r.phrase) } }
  } catch {}

  // Expansion: keyword ideas
  try {
    const ideas = await prov.keywordIdeas({ seeds: input.seeds.slice(0, 10), language: input.language, locationCode: input.locationCode, limit: input.ideasLimit ?? 1000 })
    for (const r of ideas) { const k = r.phrase.toLowerCase(); if (!seen.has(k)) { seen.add(k); all.push(r.phrase) } }
  } catch {}

  return all
}

