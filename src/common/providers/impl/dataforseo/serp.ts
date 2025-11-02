import type { SerpProvider, SerpSnapshot, SerpItem } from '../../interfaces/serp'
import { dfsClient } from './client'
import { DATAFORSEO_DEFAULT_LOCATION_CODE } from './geo'

function toTextDump(items: SerpItem[]) {
  return items
    .sort((a, b) => a.rank - b.rank)
    .map((i) => `#${i.rank} ${i.title ?? ''} ${i.url}\n${i.snippet ?? ''}`.trim())
    .join('\n\n')
}

export const dataForSeoSerp: SerpProvider = {
  async ensure({ canon, locationCode, device = 'desktop', topK = 10 }) {
    const fetchedAt = new Date().toISOString()
    const raw = await dfsClient.serpOrganic({
      keyword: canon.phrase,
      languageCode: canon.language,
      locationCode: Number(locationCode) || DATAFORSEO_DEFAULT_LOCATION_CODE,
      device
    })
    const items: SerpItem[] = raw
      .filter((r: any) => typeof r?.rank_group === 'number' && r?.type)
      .slice(0, topK)
      .map((r: any) => ({
        rank: Number(r.rank_group),
        url: String(r.url || ''),
        title: r.title ? String(r.title) : undefined,
        snippet: r.description ? String(r.description) : undefined,
        types: Array.isArray(r?.types) ? r.types : r.type ? [String(r.type)] : []
      }))
    const snap: SerpSnapshot = { fetchedAt, engine: 'google', device, topK, items, textDump: toTextDump(items) }
    return snap
  }
}
