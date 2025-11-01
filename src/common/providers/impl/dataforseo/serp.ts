import type { SerpProvider, SerpSnapshot, SerpItem } from '../../interfaces/serp'
import { config } from '@common/config'
import { dfsClient } from './client'

// Map language like 'en-US' -> 'English' for DFS language_name
function languageName(lang: string) {
  if (!lang) return 'English'
  const code = lang.toLowerCase()
  if (code.startsWith('en')) return 'English'
  if (code.startsWith('ja')) return 'Japanese'
  if (code.startsWith('es')) return 'Spanish'
  if (code.startsWith('fr')) return 'French'
  if (code.startsWith('de')) return 'German'
  if (code.startsWith('pt')) return 'Portuguese'
  if (code.startsWith('it')) return 'Italian'
  if (code.startsWith('nl')) return 'Dutch'
  if (code.startsWith('sv')) return 'Swedish'
  if (code.startsWith('no') || code.startsWith('nb') || code.startsWith('nn')) return 'Norwegian'
  if (code.startsWith('da')) return 'Danish'
  if (code.startsWith('fi')) return 'Finnish'
  if (code.startsWith('ko')) return 'Korean'
  if (code.startsWith('zh')) return 'Chinese (Simplified)'
  if (code.startsWith('ru')) return 'Russian'
  return 'English'
}

function toTextDump(items: SerpItem[]) {
  return items
    .sort((a, b) => a.rank - b.rank)
    .map((i) => `#${i.rank} ${i.title ?? ''} ${i.url}\n${i.snippet ?? ''}`.trim())
    .join('\n\n')
}

export const dataForSeoSerp: SerpProvider = {
  async ensure({ canon, locationCode, device = 'desktop', topK = 10 }) {
    const allowStubs = Boolean(config.providers.allowStubs)
    const fetchedAt = new Date().toISOString()
    const raw = await dfsClient.serpOrganicLive(canon.phrase, canon.language, Number(locationCode) || 2840, device)
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
