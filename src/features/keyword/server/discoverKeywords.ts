import { getDiscoveryProvider } from '@common/providers/registry'
import type { DiscoveryResult } from '@common/providers/interfaces/keyword-discovery'

type DiscoverKeywordsInput = {
  siteUrl?: string | null
  seeds: string[]
  language: string
  locationCode: number
  baselineLimit?: number
  relatedLimit?: number
  ideasLimit?: number
}

export async function discoverKeywords(input: DiscoverKeywordsInput): Promise<DiscoveryResult[]> {
  const provider = getDiscoveryProvider()
  const seen = new Set<string>()
  const results: DiscoveryResult[] = []

  const push = (rows: DiscoveryResult[]) => {
    for (const row of rows) {
      const phrase = String(row?.phrase || '').trim()
      if (!phrase) continue
      const key = phrase.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      results.push({ phrase, source: row.source })
    }
  }

  const uniqueSeeds = Array.from(new Set(input.seeds.map((s) => String(s || '').trim()).filter(Boolean)))

  if (input.siteUrl) {
    let domain: string
    try {
      domain = new URL(input.siteUrl).hostname
    } catch {
      throw new Error(`Invalid site URL '${input.siteUrl}' for DataForSEO keywords_for_site`)
    }
    const baseline = await provider.keywordsForSite({
      domain,
      language: input.language,
      locationCode: input.locationCode,
      limit: input.baselineLimit ?? 500
    })
    push(baseline)
  }

  if (uniqueSeeds.length) {
    const related = await provider.relatedKeywords({
      seeds: uniqueSeeds.slice(0, 20),
      language: input.language,
      locationCode: input.locationCode,
      limit: input.relatedLimit ?? 2000
    })
    push(related)

    const ideas = await provider.keywordIdeas({
      seeds: uniqueSeeds.slice(0, 10),
      language: input.language,
      locationCode: input.locationCode,
      limit: input.ideasLimit ?? 1000
    })
    push(ideas)
  }

  if (!results.length) {
    throw new Error(
      `DataForSEO returned no keywords (siteUrl=${input.siteUrl ? new URL(input.siteUrl).hostname : 'none'}, seeds=${uniqueSeeds.length}, language=${input.language}, location=${input.locationCode})`
    )
  }

  return results
}
